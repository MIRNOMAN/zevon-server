import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({ where: { role: 'CUSTOMER' }, take: 5 });
  console.log('Customers found:', users.length);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  if (users.length > 0 && admin) {
    const existingMsg = await prisma.chatMessage.findFirst();
    if (!existingMsg) {
      const c1 = users[0];
      await prisma.chatMessage.create({
        data: {
          roomId: `room_${c1.id}`,
          senderId: c1.id,
          customerId: c1.id,
          content: 'Hello, can you confirm when my bespoke blazer will be dispatched to London?',
          isRead: false,
        },
      });
      await prisma.chatMessage.create({
        data: {
          roomId: `room_${c1.id}`,
          senderId: admin.id,
          customerId: c1.id,
          content: 'Good day! Your tailored blazer is currently in final pressing and will dispatch via DHL Express tomorrow morning.',
          isRead: true,
        },
      });

      if (users[1]) {
        const c2 = users[1];
        await prisma.chatMessage.create({
          data: {
            roomId: `room_${c2.id}`,
            senderId: c2.id,
            customerId: c2.id,
            content: 'Inquiring about leather shoe sizing chart in Europe.',
            isRead: false,
          },
        });
      }
      console.log('Sample chat messages created successfully.');
    } else {
      console.log('Chat messages already present.');
    }
  }
}

run()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
