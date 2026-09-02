import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { ChatService } from './chat.service.js';
import {
  SendMessagePayloadDto,
  JoinRoomPayloadDto,
  TypingPayloadDto,
} from './dto/chat.dto.js';

export interface AuthenticatedSocketUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user: AuthenticatedSocketUser;
  };
}

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * 1. Connection & Authentication Handshake
   * Validates JWT token from client.handshake.auth.token or Authorization header.
   * Auto-assigns Customer to their private room (room_${customerId}).
   */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromHandshake(client);
      if (!token) {
        this.logger.warn(
          `Unauthorized socket connection attempt: No token provided (${client.id})`,
        );
        client.emit('error', { message: 'Authentication token required.' });
        client.disconnect(true);
        return;
      }

      const secret =
        this.configService.get<string>('jwt.accessSecret') ||
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        this.configService.get<string>('JWT_SECRET');

      const payload = await this.jwtService.verifyAsync(token, { secret });
      const userId = payload.sub || payload.id;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          avatarUrl: true,
        },
      });

      if (!user || !user.isActive) {
        this.logger.warn(
          `Socket connection rejected for inactive or missing user (${userId})`,
        );
        client.emit('error', {
          message: 'User account not active or unauthorized.',
        });
        client.disconnect(true);
        return;
      }

      (client as AuthenticatedSocket).data.user = user;

      // 2. Private Room Isolation
      if (user.role === Role.CUSTOMER) {
        const customerRoom = this.chatService.getRoomId(user.id);
        await client.join(customerRoom);
        this.logger.log(
          `Customer ${user.name} (${user.id}) joined private room: ${customerRoom}`,
        );

        client.emit('connected', {
          status: 'connected',
          user: { id: user.id, name: user.name, role: user.role },
          roomId: customerRoom,
        });
      } else {
        // ADMIN / MANAGER join general admin channel to listen for incoming customer chats
        await client.join('admin_channel');
        this.logger.log(
          `Admin/Staff ${user.name} (${user.id}) connected to admin channel`,
        );

        client.emit('connected', {
          status: 'connected',
          user: { id: user.id, name: user.name, role: user.role },
          channel: 'admin_channel',
        });
      }
    } catch (error) {
      this.logger.error(
        `Handshake error for socket ${client.id}: ${(error as Error).message}`,
      );
      client.emit('error', {
        message: 'Invalid or expired authentication token.',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client as AuthenticatedSocket).data?.user;
    if (user) {
      this.logger.log(
        `User ${user.name} (${user.id}) disconnected from socket (${client.id})`,
      );
    }
  }

  /**
   * Admin joins a specific customer's private room for 1-to-1 reply
   */
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayloadDto,
  ) {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Unauthorized socket user');
    }

    if (user.role === Role.CUSTOMER && user.id !== payload.customerId) {
      throw new WsException(
        'Customers cannot join other customer private rooms.',
      );
    }

    const roomId = this.chatService.getRoomId(payload.customerId);
    await client.join(roomId);
    this.logger.log(`User ${user.name} (${user.role}) joined ${roomId}`);

    // Notify the room that staff has joined
    this.server.to(roomId).emit('user_joined_room', {
      userId: user.id,
      name: user.name,
      role: user.role,
      roomId,
    });

    return {
      event: 'joined_room',
      data: { roomId, customerId: payload.customerId },
    };
  }

  /**
   * Leave a specific customer room
   */
  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayloadDto,
  ) {
    const user = client.data.user;
    const roomId = this.chatService.getRoomId(payload.customerId);

    await client.leave(roomId);
    this.logger.log(`User ${user.name} left ${roomId}`);

    this.server.to(roomId).emit('user_left_room', {
      userId: user.id,
      name: user.name,
      role: user.role,
      roomId,
    });

    return {
      event: 'left_room',
      data: { roomId, customerId: payload.customerId },
    };
  }

  /**
   * 3. Send Message with Offline Persistence & Private Room Broadcast
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayloadDto,
  ) {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Unauthorized socket user');
    }

    let customerId: string;
    let targetRoomId: string;

    if (user.role === Role.CUSTOMER) {
      // Customer is strictly constrained to their own room
      customerId = user.id;
      targetRoomId = this.chatService.getRoomId(user.id);
    } else {
      // Admin/Staff can send to any specified customer room
      customerId = this.chatService.extractCustomerId(payload.roomId);
      targetRoomId = this.chatService.getRoomId(customerId);
    }

    // Persist message to PostgreSQL
    const savedMessage = await this.chatService.saveMessage(
      user.id,
      customerId,
      targetRoomId,
      {
        content: payload.content,
        attachmentUrl: payload.attachmentUrl,
        attachmentType: payload.attachmentType,
      },
    );

    // Broadcast message to everyone currently in the private room (Customer & joined Admins)
    this.server.to(targetRoomId).emit('new_message', savedMessage);

    // If sent by customer, also alert the admin channel for real-time dashboard notifications
    if (user.role === Role.CUSTOMER) {
      this.server.to('admin_channel').emit('admin_incoming_message', {
        roomId: targetRoomId,
        customerId: user.id,
        customerName: user.name,
        message: savedMessage,
      });
    }

    return {
      event: 'message_sent',
      data: savedMessage,
    };
  }

  /**
   * Typing indicator broadcast within the private room
   */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingPayloadDto,
  ) {
    const user = client.data.user;
    if (!user) return;

    let targetRoomId: string;
    if (user.role === Role.CUSTOMER) {
      targetRoomId = this.chatService.getRoomId(user.id);
    } else {
      const customerId = this.chatService.extractCustomerId(payload.roomId);
      targetRoomId = this.chatService.getRoomId(customerId);
    }

    client.to(targetRoomId).emit('user_typing', {
      roomId: targetRoomId,
      userId: user.id,
      name: user.name,
      role: user.role,
      isTyping: payload.isTyping ?? true,
    });
  }

  /**
   * Mark messages as read and broadcast receipt
   */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayloadDto,
  ) {
    const user = client.data.user;
    if (!user) return;

    const customerId =
      user.role === Role.CUSTOMER ? user.id : payload.customerId;
    const targetRoomId = this.chatService.getRoomId(customerId);

    await this.chatService.markRoomMessagesAsRead(customerId, user.id);

    this.server.to(targetRoomId).emit('messages_read', {
      roomId: targetRoomId,
      readBy: user.id,
      role: user.role,
      readAt: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Helper to extract JWT token from socket handshake auth or headers
   */
  private extractTokenFromHandshake(client: Socket): string | null {
    if (
      client.handshake.auth &&
      typeof client.handshake.auth.token === 'string'
    ) {
      return client.handshake.auth.token.replace(/^Bearer\s+/i, '');
    }

    const authHeader = client.handshake.headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
      return authHeader.replace(/^Bearer\s+/i, '');
    }

    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }
}
