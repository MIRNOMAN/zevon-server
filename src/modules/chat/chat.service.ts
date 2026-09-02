import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { SendMessagePayloadDto, ChatHistoryQueryDto } from './dto/chat.dto.js';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper method to format customer room ID
   */
  getRoomId(customerId: string): string {
    return customerId.startsWith('room_') ? customerId : `room_${customerId}`;
  }

  /**
   * Helper method to extract customerId from room ID
   */
  extractCustomerId(roomId: string): string {
    return roomId.startsWith('room_') ? roomId.replace('room_', '') : roomId;
  }

  /**
   * Persists a chat message in PostgreSQL database
   */
  async saveMessage(
    senderId: string,
    customerId: string,
    roomId: string,
    payload: Partial<SendMessagePayloadDto>,
  ) {
    if (!payload.content && !payload.attachmentUrl) {
      throw new BadRequestException(
        'Message must contain either text content or an attachment.',
      );
    }

    const formattedRoomId = this.getRoomId(customerId);

    return this.prisma.chatMessage.create({
      data: {
        roomId: formattedRoomId,
        senderId,
        customerId,
        content: payload.content?.trim() || null,
        attachmentUrl: payload.attachmentUrl || null,
        attachmentType: payload.attachmentType || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Fetches paginated chat history for a customer's private room.
   * Customers can only access their own room history; Admins/Managers can access any.
   */
  async getRoomHistory(
    customerId: string,
    requestingUser: { id: string; role: Role },
    query: ChatHistoryQueryDto,
  ) {
    const cleanCustomerId = this.extractCustomerId(customerId);

    // Private Room Isolation Check
    if (
      requestingUser.role === Role.CUSTOMER &&
      requestingUser.id !== cleanCustomerId
    ) {
      throw new ForbiddenException(
        'Access denied: You can only access your own chat history.',
      );
    }

    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 30;
    const skip = (page - 1) * limit;

    const formattedRoomId = this.getRoomId(cleanCustomerId);

    const [total, messages] = await Promise.all([
      this.prisma.chatMessage.count({
        where: {
          OR: [{ roomId: formattedRoomId }, { customerId: cleanCustomerId }],
        },
      }),
      this.prisma.chatMessage.findMany({
        where: {
          OR: [{ roomId: formattedRoomId }, { customerId: cleanCustomerId }],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    // Reverse messages to present them chronologically
    return {
      messages: messages.reverse(),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        roomId: formattedRoomId,
        customerId: cleanCustomerId,
      },
    };
  }

  /**
   * Admin-facing list of active customer conversations with last message and unread count.
   */
  async getAdminActiveRooms(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Get list of distinct customers who have messages
    const distinctRooms = await this.prisma.chatMessage.groupBy({
      by: ['customerId'],
      _max: {
        createdAt: true,
      },
      orderBy: {
        _max: {
          createdAt: 'desc',
        },
      },
      skip,
      take: limit,
    });

    const totalRooms = await this.prisma.chatMessage
      .groupBy({
        by: ['customerId'],
      })
      .then((res) => res.length);

    const roomDetails = await Promise.all(
      distinctRooms.map(async (room) => {
        const customer = await this.prisma.user.findUnique({
          where: { id: room.customerId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            role: true,
          },
        });

        const lastMessage = await this.prisma.chatMessage.findFirst({
          where: { customerId: room.customerId },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        });

        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            customerId: room.customerId,
            senderId: room.customerId,
            isRead: false,
          },
        });

        return {
          roomId: this.getRoomId(room.customerId),
          customerId: room.customerId,
          customer: customer || {
            id: room.customerId,
            name: 'Unknown User',
            email: 'N/A',
          },
          lastMessage,
          unreadCount,
          updatedAt: room._max.createdAt,
        };
      }),
    );

    return {
      rooms: roomDetails,
      meta: {
        total: totalRooms,
        page,
        limit,
        totalPages: Math.ceil(totalRooms / limit) || 1,
      },
    };
  }

  /**
   * Marks unread messages in a room as read
   */
  async markRoomMessagesAsRead(customerId: string, readerUserId: string) {
    const cleanCustomerId = this.extractCustomerId(customerId);

    return this.prisma.chatMessage.updateMany({
      where: {
        customerId: cleanCustomerId,
        senderId: { not: readerUserId },
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }

  /**
   * Verifies if customer exists
   */
  async validateCustomer(customerId: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found.`);
    }

    return customer;
  }
}
