/**
 * Seed script for populating essential baseline database records.
 *
 * All business entities (Products, Categories, Banners, Shipping Zones, etc.)
 * are managed dynamically via the Admin Dashboard.
 *
 * Run with: npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding essential database records...');

  // Create or verify default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      role: 'ADMIN',
    },
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin user ready: ${admin.email} (role: ${admin.role})`);
  console.log('✨ Dynamic data can now be created and managed directly via the ZEVON Dashboard.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

