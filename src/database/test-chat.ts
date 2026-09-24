import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  const distinctRooms = await prisma.chatMessage.groupBy({
    by: ['customerId'],
    _max: {
      createdAt: true,
    },
    orderBy: {
      _max: {
        createdAt: 'desc',
      },
    },
  });

  console.log('Distinct rooms:', distinctRooms);

  const roomDetails = await Promise.all(
    distinctRooms.map(async (room) => {
      const customer = await prisma.user.findUnique({
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

      const lastMessage = await prisma.chatMessage.findFirst({
        where: { customerId: room.customerId },
        orderBy: { createdAt: 'desc' },
      });

      const unreadCount = await prisma.chatMessage.count({
        where: {
          customerId: room.customerId,
          senderId: room.customerId,
          isRead: false,
        },
      });

      return {
        roomId: `room_${room.customerId}`,
        customerId: room.customerId,
        customer,
        lastMessage,
        unreadCount,
        updatedAt: room._max.createdAt,
      };
    }),
  );

  console.log('Room details result:', JSON.stringify(roomDetails, null, 2));
}

test()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
