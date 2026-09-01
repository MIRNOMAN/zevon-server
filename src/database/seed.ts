/**
 * Seed script for populating the database with initial data.
 *
 * Run with: npx prisma db seed
 * (Configured in package.json under "prisma.seed")
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Seed default Shipping Zones for Bangladesh
  const shippingZones = [
    {
      code: 'INSIDE_DHAKA',
      name: 'Inside Dhaka City',
      description:
        'Standard and express delivery across all Dhaka Metropolitan areas.',
      cities: [
        'Dhaka',
        'Dhaka City',
        'Gulshan',
        'Banani',
        'Dhanmondi',
        'Uttara',
        'Mirpur',
        'Mohammadpur',
        'Motijheel',
        'Badda',
        'Khilgaon',
      ],
      postalCodes: [
        '1000',
        '1100',
        '1200',
        '1203',
        '1204',
        '1205',
        '1206',
        '1207',
        '1208',
        '1209',
        '1211',
        '1212',
        '1213',
        '1214',
        '1215',
        '1216',
        '1217',
        '1219',
        '1221',
        '1222',
        '1225',
        '1229',
        '1230',
      ],
      cost: 60.0,
      expressCost: 130.0,
      freeShippingThreshold: 2000.0,
      minOrderAmount: 0.0,
      estimatedDeliveryDays: '1-2 Business Days',
      expressDeliveryDays: 'Same-Day Delivery (4-6 Hours)',
      isDefault: false,
      isActive: true,
      sortOrder: 1,
    },
    {
      code: 'DHAKA_SUBURBS',
      name: 'Dhaka Suburbs & Greater Dhaka',
      description:
        'Courier delivery covering Gazipur, Narayanganj, Savar, and Keraniganj.',
      cities: [
        'Gazipur',
        'Narayanganj',
        'Savar',
        'Keraniganj',
        'Tongi',
        'Ashulia',
        'Dhamrai',
        'Narsingdi',
        'Munshiganj',
        'Manikganj',
      ],
      postalCodes: [
        '1310',
        '1311',
        '1312',
        '1340',
        '1342',
        '1344',
        '1345',
        '1400',
        '1410',
        '1420',
        '1430',
        '1700',
        '1710',
        '1711',
        '1712',
        '1720',
        '1730',
      ],
      cost: 90.0,
      expressCost: 180.0,
      freeShippingThreshold: 2500.0,
      minOrderAmount: 0.0,
      estimatedDeliveryDays: '2-3 Business Days',
      expressDeliveryDays: 'Next-Day Express',
      isDefault: false,
      isActive: true,
      sortOrder: 2,
    },
    {
      code: 'OUTSIDE_DHAKA',
      name: 'Outside Dhaka (All Bangladesh)',
      description:
        'Nationwide courier delivery across all 64 districts in Bangladesh.',
      cities: [
        'Chittagong',
        'Chattogram',
        'Sylhet',
        'Rajshahi',
        'Khulna',
        'Barisal',
        'Rangpur',
        'Mymensingh',
        'Comilla',
        'Cumilla',
        "Cox's Bazar",
        'Bogra',
        'Jessore',
        'Kushtia',
        'Dinajpur',
        'Feni',
        'Brahmanbaria',
        'Noakhali',
      ],
      postalCodes: [],
      cost: 120.0,
      expressCost: null,
      freeShippingThreshold: 3500.0,
      minOrderAmount: 0.0,
      estimatedDeliveryDays: '3-5 Business Days',
      expressDeliveryDays: null,
      isDefault: true,
      isActive: true,
      sortOrder: 3,
    },
  ];

  for (const zone of shippingZones) {
    await prisma.shippingZone.upsert({
      where: { code: zone.code },
      update: zone,
      create: zone,
    });
  }

  console.log(
    `✅ Default shipping zones seeded (${shippingZones.length} zones)`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
