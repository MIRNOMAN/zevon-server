/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Server } from 'socket.io';
import { ChatGateway, AuthenticatedSocket } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { PrismaService } from '../../database/prisma.service.js';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: ChatService;
  let jwtService: JwtService;
  let prisma: PrismaService;

  const mockCustomer = {
    id: 'cust-1',
    name: 'Customer One',
    email: 'cust1@example.com',
    role: Role.CUSTOMER,
    isActive: true,
    avatarUrl: null,
  };

  const mockAdmin = {
    id: 'admin-1',
    name: 'Admin One',
    email: 'admin@example.com',
    role: Role.ADMIN,
    isActive: true,
    avatarUrl: null,
  };

  const mockSavedMessage = {
    id: 'msg-1',
    roomId: 'room_cust-1',
    senderId: 'cust-1',
    customerId: 'cust-1',
    content: 'Hello Admin',
    attachmentUrl: null,
    attachmentType: null,
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sender: mockCustomer,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockResolvedValue({ sub: 'cust-1' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue(mockCustomer),
            },
          },
        },
        {
          provide: ChatService,
          useValue: {
            getRoomId: jest.fn(
              (id: string) => `room_${id.replace('room_', '')}`,
            ),
            extractCustomerId: jest.fn((id: string) => id.replace('room_', '')),
            saveMessage: jest.fn().mockResolvedValue(mockSavedMessage),
            markRoomMessagesAsRead: jest.fn().mockResolvedValue({ count: 1 }),
          },
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    chatService = module.get<ChatService>(ChatService);
    jwtService = module.get<JwtService>(JwtService);
    prisma = module.get<PrismaService>(PrismaService);

    // Mock server.to().emit()
    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as unknown as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should authenticate customer and auto-join room_${customerId}', async () => {
      const mockSocket = {
        id: 'sock-1',
        handshake: {
          auth: { token: 'valid-jwt-token' },
          headers: {},
        },
        join: jest.fn().mockResolvedValue(undefined),
        emit: jest.fn(),
        disconnect: jest.fn(),
        data: {},
      } as unknown as AuthenticatedSocket;

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('room_cust-1');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'connected',
        expect.objectContaining({
          roomId: 'room_cust-1',
        }),
      );
      expect(mockSocket.data.user).toEqual(mockCustomer);
    });

    it('should authenticate admin and join admin_channel', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 'admin-1',
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdmin);

      const mockSocket = {
        id: 'sock-2',
        handshake: {
          auth: { token: 'valid-admin-token' },
          headers: {},
        },
        join: jest.fn().mockResolvedValue(undefined),
        emit: jest.fn(),
        disconnect: jest.fn(),
        data: {},
      } as unknown as AuthenticatedSocket;

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('admin_channel');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'connected',
        expect.objectContaining({
          channel: 'admin_channel',
        }),
      );
    });

    it('should disconnect socket when token is missing', async () => {
      const mockSocket = {
        id: 'sock-3',
        handshake: {
          auth: {},
          headers: {},
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as AuthenticatedSocket;

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.any(Object));
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleSendMessage', () => {
    it('should persist message and broadcast to room for customer', async () => {
      const mockSocket = {
        data: { user: mockCustomer },
      } as unknown as AuthenticatedSocket;

      const result = await gateway.handleSendMessage(mockSocket, {
        roomId: 'room_cust-1',
        content: 'Hello Admin',
      });

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        'cust-1',
        'cust-1',
        'room_cust-1',
        {
          content: 'Hello Admin',
          attachmentUrl: undefined,
          attachmentType: undefined,
        },
      );
      expect(gateway.server.to).toHaveBeenCalledWith('room_cust-1');
      expect(result.data).toEqual(mockSavedMessage);
    });

    it('should allow admin to send message to any customer room', async () => {
      const mockSocket = {
        data: { user: mockAdmin },
      } as unknown as AuthenticatedSocket;

      await gateway.handleSendMessage(mockSocket, {
        roomId: 'room_cust-1',
        content: 'How can we help you?',
      });

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        'admin-1',
        'cust-1',
        'room_cust-1',
        {
          content: 'How can we help you?',
          attachmentUrl: undefined,
          attachmentType: undefined,
        },
      );
      expect(gateway.server.to).toHaveBeenCalledWith('room_cust-1');
    });
  });

  describe('handleJoinRoom', () => {
    it('should allow admin to join customer room', async () => {
      const mockSocket = {
        data: { user: mockAdmin },
        join: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuthenticatedSocket;

      const result = await gateway.handleJoinRoom(mockSocket, {
        customerId: 'cust-1',
      });

      expect(mockSocket.join).toHaveBeenCalledWith('room_cust-1');
      expect(result.data.roomId).toBe('room_cust-1');
    });

    it('should forbid customer from joining another customer room', async () => {
      const mockSocket = {
        data: { user: mockCustomer },
        join: jest.fn(),
      } as unknown as AuthenticatedSocket;

      await expect(
        gateway.handleJoinRoom(mockSocket, { customerId: 'other-cust' }),
      ).rejects.toThrow(WsException);
    });
  });
});
