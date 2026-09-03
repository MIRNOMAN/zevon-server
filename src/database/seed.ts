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

  // Seed default Banners for Hero Slider and Sections
  const banners = [
    {
      title: 'URBAN LUXURY. MINIMALIST ESSENCE.',
      subtitle:
        'Architectural silhouettes engineered with 380+ GSM super-combed organic cotton. Designed for the modern wardrobe and crafted ethically in Bangladesh.',
      badge: 'SS/26 Collection Now Live • Drop 01',
      imageUrl:
        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&auto=format&fit=crop&q=80',
      mobileImageUrl:
        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80',
      ctaText: 'Explore New Drops',
      linkUrl: '/shop?filter=new',
      placement: 'HERO' as const,
      sortOrder: 1,
      isActive: true,
    },
    {
      title: 'HEAVYWEIGHT OVERSIZED ESSENTIALS.',
      subtitle:
        'Structured 380+ GSM boxy silhouettes, drop-shoulder designs, and custom-dyed muted earthy palettes.',
      badge: 'Limited Archive Drop',
      imageUrl:
        'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=80',
      mobileImageUrl:
        'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80',
      ctaText: 'Shop Oversized',
      linkUrl: '/shop?category=t-shirts',
      placement: 'HERO' as const,
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'CONTEMPORARY MONOCHROME SETS.',
      subtitle:
        'Effortlessly coordinated ribbed knit co-ords and tailored pleated trousers built for everyday versatility.',
      badge: 'New Season',
      imageUrl:
        'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1600&auto=format&fit=crop&q=80',
      mobileImageUrl:
        'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&auto=format&fit=crop&q=80',
      ctaText: 'Explore Co-Ords',
      linkUrl: '/shop?category=co-ords',
      placement: 'HERO' as const,
      sortOrder: 3,
      isActive: true,
    },
  ];

  for (const banner of banners) {
    const existing = await prisma.banner.findFirst({
      where: { title: banner.title, placement: banner.placement },
    });

    if (existing) {
      await prisma.banner.update({
        where: { id: existing.id },
        data: banner,
      });
    } else {
      await prisma.banner.create({
        data: banner,
      });
    }
  }

  console.log(`✅ Default banners seeded (${banners.length} banners)`);

  // Seed default Categories (Hierarchical Root & Sub-categories)
  const categorySeeds = [
    {
      name: "Men's Streetwear",
      slug: 'men',
      description: '380 GSM Drop-Shoulder Tees, Cargos & Hoodies',
      imageUrl:
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
      sortOrder: 1,
      children: [
        {
          name: 'T-Shirts & Tops',
          slug: 'men-t-shirts',
          description: 'Oversized 380+ GSM heavyweight tees',
          sortOrder: 1,
        },
        {
          name: 'Hoodies & Sweatshirts',
          slug: 'men-hoodies',
          description: 'French terry and fleece relaxed hoodies',
          sortOrder: 2,
        },
        {
          name: 'Pants & Cargos',
          slug: 'men-pants',
          description: 'Tailored utility cargos and wide-leg trousers',
          sortOrder: 3,
        },
        {
          name: 'Co-ords & Sets',
          slug: 'men-coords',
          description: 'Matching minimal top and bottom sets',
          sortOrder: 4,
        },
      ],
    },
    {
      name: "Women's Minimalist Co-ords",
      slug: 'women',
      description: 'Two-Piece Knit Sets, Wide Leg Trousers & Ribbed Tops',
      imageUrl:
        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=80',
      sortOrder: 2,
      children: [
        {
          name: 'Co-ords & Matching Sets',
          slug: 'women-coords',
          description: 'Ribbed knit and linen co-ord sets',
          sortOrder: 1,
        },
        {
          name: 'Dresses & Jumpsuits',
          slug: 'women-dresses',
          description: 'Architectural column dresses and slips',
          sortOrder: 2,
        },
        {
          name: 'Tops & Tees',
          slug: 'women-tops',
          description: 'Sculpted crop tops and baby tees',
          sortOrder: 3,
        },
        {
          name: 'Trousers & Skirts',
          slug: 'women-trousers',
          description: 'High-waisted pleated trousers and maxi skirts',
          sortOrder: 4,
        },
      ],
    },
    {
      name: 'Tailored Outerwear & Jackets',
      slug: 'outerwear',
      description: 'Minimalist Blazers, Structured Trench & Bombers',
      imageUrl:
        'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=900&auto=format&fit=crop&q=80',
      sortOrder: 3,
      children: [
        {
          name: 'Jackets & Bombers',
          slug: 'jackets-bombers',
          description: 'Cropped flight jackets and leather bombers',
          sortOrder: 1,
        },
        {
          name: 'Trench & Overcoats',
          slug: 'trench-overcoats',
          description: 'Longline structured double-breasted coats',
          sortOrder: 2,
        },
        {
          name: 'Blazers',
          slug: 'blazers',
          description: 'Relaxed oversized tailored blazers',
          sortOrder: 3,
        },
      ],
    },
    {
      name: 'Architectural Accessories',
      slug: 'accessories',
      description: 'Leather Goods, Silver Jewelry & Canvas Caps',
      imageUrl:
        'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&auto=format&fit=crop&q=80',
      sortOrder: 4,
      children: [
        {
          name: 'Caps & Headwear',
          slug: 'caps-headwear',
          description: 'Distressed canvas caps and beanies',
          sortOrder: 1,
        },
        {
          name: 'Bags & Crossbody',
          slug: 'bags-wallets',
          description: 'Minimalist tote bags and technical chest rigs',
          sortOrder: 2,
        },
        {
          name: 'Jewelry & Silverware',
          slug: 'jewelry',
          description: '925 silver chains, signet rings and cuffs',
          sortOrder: 3,
        },
      ],
    },
  ];

  for (const catSeed of categorySeeds) {
    const { children, ...parentData } = catSeed;
    const parent = await prisma.category.upsert({
      where: { slug: parentData.slug },
      update: {
        name: parentData.name,
        description: parentData.description,
        imageUrl: parentData.imageUrl,
        sortOrder: parentData.sortOrder,
        isActive: true,
      },
      create: {
        ...parentData,
        isActive: true,
      },
    });

    if (children && children.length > 0) {
      for (const child of children) {
        await prisma.category.upsert({
          where: { slug: child.slug },
          update: {
            name: child.name,
            description: child.description,
            sortOrder: child.sortOrder,
            parentId: parent.id,
            isActive: true,
          },
          create: {
            ...child,
            parentId: parent.id,
            isActive: true,
          },
        });
      }
    }
  }

  console.log(
    `✅ Default categories seeded (${categorySeeds.length} root categories with subcategories)`,
  );

  // Seed default Products for Men & Women categories
  const productSeeds = [
    // ── MEN'S PRODUCTS ──────────────────────────────────────────
    {
      title: 'Architectural Minimalist Heavyweight Tee',
      slug: 'architectural-minimalist-heavyweight-tee',
      description:
        'Crafted from 100% super-combed organic cotton with double-needle ribbed collar and pre-shrunk wash. Designed for effortless streetwear drape.',
      details: 'Boxy oversized fit, heavy drape, pre-shrunk organic fabric.',
      fabricSpecs: '100% Super-Combed Organic Cotton, 380 GSM Heavy Interlock Weave.',
      washCare: 'Cold machine wash inside out. Do not tumble dry.',
      tags: ['Heavyweight', 'Oversized', 'Streetwear', 'Organic', 'Tee', 'T-Shirt', 'SS26'],
      basePrice: 1850,
      discountPrice: 1450,
      categorySlug: 'men-t-shirts',
      gender: 'MEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
          altText: 'Architectural Minimalist Heavyweight Tee',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-MEN-TEE-MIN-S', color: 'Washed Onyx', colorCode: '#1C1917', size: 'S', stock: 25 },
        { sku: 'ZEV-MEN-TEE-MIN-M', color: 'Washed Onyx', colorCode: '#1C1917', size: 'M', stock: 40 },
        { sku: 'ZEV-MEN-TEE-MIN-L', color: 'Washed Onyx', colorCode: '#1C1917', size: 'L', stock: 35 },
      ],
    },
    {
      title: 'Heavy French Terry Oversized Hoodie',
      slug: 'heavy-french-terry-oversized-hoodie',
      description:
        'Ultra-dense 450 GSM unbrushed loopback cotton fleece. Features double-lined hood with zero drawstrings for clean minimalist aesthetic.',
      details: 'Relaxed boxy fit, heavyweight drape, seamless crossover hood.',
      fabricSpecs: '100% Organic Heavy French Terry Loopback Cotton (450 GSM).',
      washCare: 'Machine wash cold with similar colors.',
      tags: ['Hoodie', 'French Terry', 'Heavyweight', 'Oversized', 'Streetwear', 'Winter'],
      basePrice: 3450,
      discountPrice: 2950,
      categorySlug: 'men-hoodies',
      gender: 'MEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=900&auto=format&fit=crop&q=80',
          altText: 'Heavy French Terry Oversized Hoodie',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-MEN-HD-TER-M', color: 'Pitch Black', colorCode: '#0A0A0A', size: 'M', stock: 20 },
        { sku: 'ZEV-MEN-HD-TER-L', color: 'Pitch Black', colorCode: '#0A0A0A', size: 'L', stock: 25 },
        { sku: 'ZEV-MEN-HD-TER-XL', color: 'Pitch Black', colorCode: '#0A0A0A', size: 'XL', stock: 15 },
      ],
    },
    {
      title: 'ZEVON 380 GSM Heavyweight Oversized Tee',
      slug: 'zevon-380-gsm-heavyweight-oversized-tee',
      description:
        'Engineered with 380 GSM super-combed organic cotton. Designed with a structured boxy cut, drop-shoulder silhouette, and reinforced ribbed collar.',
      details: 'Boxy oversized fit, heavy drape, pre-shrunk organic fabric.',
      fabricSpecs: '100% Super-Combed Organic Cotton, 380 GSM Heavy Interlock Weave.',
      washCare: 'Cold machine wash inside out. Do not tumble dry.',
      tags: ['Heavyweight', 'Oversized', 'Streetwear', 'Organic', 'SS26'],
      basePrice: 1850,
      discountPrice: 1450,
      categorySlug: 'men-t-shirts',
      gender: 'MEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
          altText: 'ZEVON 380 GSM Heavyweight Tee - Front View',
          isPrimary: true,
        },
        {
          url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80',
          altText: 'ZEVON 380 GSM Heavyweight Tee - Detail',
          isPrimary: false,
        },
      ],
      variants: [
        { sku: 'ZEV-MEN-TEE-BLK-S', color: 'Onyx Black', colorCode: '#111111', size: 'S', stock: 25 },
        { sku: 'ZEV-MEN-TEE-BLK-M', color: 'Onyx Black', colorCode: '#111111', size: 'M', stock: 40 },
        { sku: 'ZEV-MEN-TEE-BLK-L', color: 'Onyx Black', colorCode: '#111111', size: 'L', stock: 35 },
        { sku: 'ZEV-MEN-TEE-WHT-M', color: 'Chalk White', colorCode: '#F4F4F0', size: 'M', stock: 30 },
        { sku: 'ZEV-MEN-TEE-WHT-L', color: 'Chalk White', colorCode: '#F4F4F0', size: 'L', stock: 25 },
      ],
    },
    {
      title: 'Minimalist Acid Wash Drop-Shoulder Hoodie',
      slug: 'minimalist-acid-wash-drop-shoulder-hoodie',
      description:
        '450 GSM luxury brushed fleece hoodie with double-layered crossover hood and hidden side-seam pockets.',
      details: 'Drop shoulder, ribbed cuffs and hem, custom acid wash treatment.',
      fabricSpecs: '80% Organic Cotton, 20% Recycled Poly Fleece (450 GSM).',
      washCare: 'Machine wash cold with similar colors.',
      tags: ['Hoodie', 'Fleece', 'Acid Wash', 'Winter', 'Streetwear'],
      basePrice: 3200,
      discountPrice: null,
      categorySlug: 'men-hoodies',
      gender: 'MEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=900&auto=format&fit=crop&q=80',
          altText: 'Minimalist Acid Wash Hoodie',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-MEN-HD-CHR-M', color: 'Charcoal Wash', colorCode: '#333333', size: 'M', stock: 20 },
        { sku: 'ZEV-MEN-HD-CHR-L', color: 'Charcoal Wash', colorCode: '#333333', size: 'L', stock: 25 },
        { sku: 'ZEV-MEN-HD-CHR-XL', color: 'Charcoal Wash', colorCode: '#333333', size: 'XL', stock: 15 },
      ],
    },
    {
      title: 'Architectural Wide-Leg Utility Cargo Pants',
      slug: 'architectural-wide-leg-utility-cargo-pants',
      description:
        'Structured cotton twill cargo trousers with 3D articulated cargo pockets and adjustable ankle bungee cords.',
      details: 'Relaxed wide leg, deep cargo bellows, matte hardware.',
      fabricSpecs: '100% Heavyweight Cotton Twill (320 GSM).',
      washCare: 'Machine wash cold, iron inside out.',
      tags: ['Cargos', 'Utility', 'Pants', 'Streetwear'],
      basePrice: 2850,
      discountPrice: 2450,
      categorySlug: 'men-pants',
      gender: 'MEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=900&auto=format&fit=crop&q=80',
          altText: 'Architectural Wide-Leg Cargo Pants',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-MEN-CRG-OLV-30', color: 'Olive Green', colorCode: '#4B5320', size: 'M', stock: 18 },
        { sku: 'ZEV-MEN-CRG-OLV-32', color: 'Olive Green', colorCode: '#4B5320', size: 'L', stock: 22 },
        { sku: 'ZEV-MEN-CRG-BLK-30', color: 'Matte Black', colorCode: '#1A1A1A', size: 'M', stock: 20 },
        { sku: 'ZEV-MEN-CRG-BLK-32', color: 'Matte Black', colorCode: '#1A1A1A', size: 'L', stock: 18 },
      ],
    },
    {
      title: 'Monochrome Heavy Knit Co-ord Set',
      slug: 'monochrome-heavy-knit-co-ord-set',
      description:
        'Two-piece matching waffle knit shirt and relaxed shorts set engineered for breathable luxury and everyday ease.',
      details: 'Relaxed silhouette, elasticated waistband, matching tonal buttons.',
      fabricSpecs: '100% Combed Compact Cotton Waffle Knit.',
      washCare: 'Hand wash or delicate cycle.',
      tags: ['Co-ord', 'Knitwear', 'Set', 'Luxury'],
      basePrice: 3800,
      discountPrice: null,
      categorySlug: 'men-coords',
      gender: 'MEN',
      season: 'SS/26',
      isFeatured: false,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&auto=format&fit=crop&q=80',
          altText: 'Monochrome Heavy Knit Co-ord Set',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-MEN-CRD-SND-M', color: 'Sand Dune', colorCode: '#C2B280', size: 'M', stock: 15 },
        { sku: 'ZEV-MEN-CRD-SND-L', color: 'Sand Dune', colorCode: '#C2B280', size: 'L', stock: 15 },
      ],
    },

    // ── WOMEN'S PRODUCTS ────────────────────────────────────────
    {
      title: 'Ribbed Knit Crop Top & Trouser Co-ord',
      slug: 'ribbed-knit-crop-top-trouser-co-ord',
      description:
        'A versatile two-piece lounge and streetwear set made with premium stretch rib knit. Fluid wide-leg pants paired with sculpted top.',
      details: 'Sculpting ribbed knit fabric with 4-way stretch and fluid drape.',
      fabricSpecs: '92% Organic Cotton Rib, 8% Elastane (320 GSM).',
      washCare: 'Machine wash cold on gentle cycle. Flat dry.',
      tags: ['Co-ord', 'Ribbed Knit', 'Women', 'Minimalist', 'SS26'],
      basePrice: 3200,
      discountPrice: 2800,
      categorySlug: 'women-coords',
      gender: 'WOMEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=80',
          altText: 'Ribbed Knit Crop Top & Trouser Co-ord',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-WMN-CRD-RIB-XS', color: 'Espresso Brown', colorCode: '#3E2723', size: 'XS', stock: 18 },
        { sku: 'ZEV-WMN-CRD-RIB-S', color: 'Espresso Brown', colorCode: '#3E2723', size: 'S', stock: 25 },
        { sku: 'ZEV-WMN-CRD-RIB-M', color: 'Espresso Brown', colorCode: '#3E2723', size: 'M', stock: 20 },
      ],
    },
    {
      title: 'Pleated Wide-Leg Tonal Trousers',
      slug: 'pleated-wide-leg-tonal-trousers',
      description:
        'Contemporary relaxed-fit wide-leg trousers featuring front double pleats and structured belt loops.',
      details: 'Deep front pleats, slant pockets, tailored relaxed fit.',
      fabricSpecs: '65% Tencel, 35% Rayon Twill (Fluid Stretch).',
      washCare: 'Dry clean recommended.',
      tags: ['Trousers', 'Pleated', 'Tailored', 'Women', 'Pants'],
      basePrice: 2850,
      discountPrice: 2450,
      categorySlug: 'women-trousers',
      gender: 'WOMEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&auto=format&fit=crop&q=80',
          altText: 'Pleated Wide-Leg Tonal Trousers',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-WMN-PLEAT-S', color: 'Warm Taupe', colorCode: '#B38B6D', size: 'S', stock: 20 },
        { sku: 'ZEV-WMN-PLEAT-M', color: 'Warm Taupe', colorCode: '#B38B6D', size: 'M', stock: 25 },
      ],
    },
    {
      title: 'Monochrome Ribbed Knit Two-Piece Co-ord',
      slug: 'monochrome-ribbed-knit-two-piece-co-ord',
      description:
        'Sculpted square-neck sleeveless top paired with flattering high-rise wide-leg ribbed knit trousers.',
      details: 'Sculpting ribbed knit fabric with 4-way stretch and fluid drape.',
      fabricSpecs: '92% Organic Cotton Rib, 8% Elastane (340 GSM).',
      washCare: 'Machine wash cold on gentle cycle. Flat dry.',
      tags: ['Co-ord', 'Ribbed Knit', 'Women', 'Minimalist', 'SS26'],
      basePrice: 3450,
      discountPrice: 2950,
      categorySlug: 'women-coords',
      gender: 'WOMEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=80',
          altText: 'Monochrome Ribbed Knit Co-ord',
          isPrimary: true,
        },
        {
          url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900&auto=format&fit=crop&q=80',
          altText: 'Monochrome Ribbed Knit Co-ord Detail',
          isPrimary: false,
        },
      ],
      variants: [
        { sku: 'ZEV-WMN-CRD-OAT-XS', color: 'Oatmeal Heather', colorCode: '#DCD7D0', size: 'XS', stock: 18 },
        { sku: 'ZEV-WMN-CRD-OAT-S', color: 'Oatmeal Heather', colorCode: '#DCD7D0', size: 'S', stock: 30 },
        { sku: 'ZEV-WMN-CRD-OAT-M', color: 'Oatmeal Heather', colorCode: '#DCD7D0', size: 'M', stock: 25 },
        { sku: 'ZEV-WMN-CRD-BLK-S', color: 'Midnight Black', colorCode: '#0D0D0D', size: 'S', stock: 20 },
        { sku: 'ZEV-WMN-CRD-BLK-M', color: 'Midnight Black', colorCode: '#0D0D0D', size: 'M', stock: 22 },
      ],
    },
    {
      title: 'Architectural Column Maxi Slip Dress',
      slug: 'architectural-column-maxi-slip-dress',
      description:
        'Minimalist bias-cut column slip dress featuring an open square back and side slit detail.',
      details: 'Bias cut for natural drape, discreet side-zip closure.',
      fabricSpecs: '100% Eco-Vero Viscose Satin with Silk Touch.',
      washCare: 'Dry clean or gentle hand wash.',
      tags: ['Dress', 'Slip Dress', 'Evening', 'Minimalist'],
      basePrice: 3200,
      discountPrice: null,
      categorySlug: 'women-dresses',
      gender: 'WOMEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&auto=format&fit=crop&q=80',
          altText: 'Architectural Column Maxi Dress',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-WMN-DRS-SLT-S', color: 'Slate Grey', colorCode: '#708090', size: 'S', stock: 15 },
        { sku: 'ZEV-WMN-DRS-SLT-M', color: 'Slate Grey', colorCode: '#708090', size: 'M', stock: 20 },
        { sku: 'ZEV-WMN-DRS-BLK-S', color: 'Pure Noir', colorCode: '#0A0A0A', size: 'S', stock: 18 },
      ],
    },
    {
      title: 'Sculpted Organic Cotton Baby Crop Top',
      slug: 'sculpted-organic-cotton-baby-crop-top',
      description:
        'Fitted heavyweight baby tee with high crew neck and double-stitched raw hem detail.',
      details: 'Form-flattering crop cut, super soft pre-washed organic cotton.',
      fabricSpecs: '95% Organic Cotton, 5% Spandex (280 GSM).',
      washCare: 'Machine wash cold, lay flat to dry.',
      tags: ['Crop Top', 'Baby Tee', 'Essentials', 'Organic'],
      basePrice: 1650,
      discountPrice: null,
      categorySlug: 'women-tops',
      gender: 'WOMEN',
      season: 'SS/26',
      isFeatured: false,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80',
          altText: 'Sculpted Organic Cotton Crop Top',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-WMN-TOP-WHT-S', color: 'Pure White', colorCode: '#FFFFFF', size: 'S', stock: 25 },
        { sku: 'ZEV-WMN-TOP-WHT-M', color: 'Pure White', colorCode: '#FFFFFF', size: 'M', stock: 25 },
        { sku: 'ZEV-WMN-TOP-BLK-S', color: 'Pitch Black', colorCode: '#111111', size: 'S', stock: 25 },
      ],
    },
    {
      title: 'High-Waisted Tailored Pleated Trousers',
      slug: 'high-waisted-tailored-pleated-trousers',
      description:
        'Contemporary relaxed-fit wide-leg trousers featuring front double pleats and structured belt loops.',
      details: 'Deep front pleats, slant pockets, tailored relaxed fit.',
      fabricSpecs: '65% Tencel, 35% Rayon Twill (Fluid Stretch).',
      washCare: 'Dry clean recommended.',
      tags: ['Trousers', 'Pleated', 'Tailored', 'Workwear'],
      basePrice: 2650,
      discountPrice: 2250,
      categorySlug: 'women-trousers',
      gender: 'WOMEN',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=900&auto=format&fit=crop&q=80',
          altText: 'High-Waisted Tailored Pleated Trousers',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-WMN-TRS-TAU-S', color: 'Warm Taupe', colorCode: '#B38B6D', size: 'S', stock: 15 },
        { sku: 'ZEV-WMN-TRS-TAU-M', color: 'Warm Taupe', colorCode: '#B38B6D', size: 'M', stock: 20 },
      ],
    },

    // ── OUTERWEAR & ACCESSORIES ─────────────────────────────────
    {
      title: 'Structured Oversized Trench Coat',
      slug: 'structured-oversized-trench-coat',
      description:
        'Architectural double-breasted longline trench crafted with heavy gabardine cotton, tonal horn buttons, and wide storm flap.',
      details: 'Longline silhouette, raglan sleeves, storm collar.',
      fabricSpecs: '100% Water-Resistant Heavy Cotton Gabardine (420 GSM).',
      washCare: 'Dry clean only.',
      tags: ['Trench', 'Overcoat', 'Outerwear', 'Tailored', 'Winter'],
      basePrice: 5200,
      discountPrice: 4600,
      categorySlug: 'trench-overcoats',
      gender: 'UNISEX',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=900&auto=format&fit=crop&q=80',
          altText: 'Structured Oversized Trench Coat',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-OUT-TRN-KHK-M', color: 'Oatmeal Khaki', colorCode: '#C3B091', size: 'M', stock: 10 },
        { sku: 'ZEV-OUT-TRN-KHK-L', color: 'Oatmeal Khaki', colorCode: '#C3B091', size: 'L', stock: 12 },
      ],
    },
    {
      title: 'Structured Boxy Flight Bomber Jacket',
      slug: 'structured-boxy-flight-bomber-jacket',
      description:
        'Water-resistant matte nylon bomber jacket with heavy silver metal zip, orange safety satin lining, and sleeve utility pocket.',
      details: 'Oversized boxy cut, ribbed collar, storm flap.',
      fabricSpecs: '100% Recycled Water-Repellent Matte Nylon with Polyfill.',
      washCare: 'Wipe clean or dry clean.',
      tags: ['Bomber', 'Jackets', 'Outerwear', 'Unisex'],
      basePrice: 4800,
      discountPrice: 3950,
      categorySlug: 'jackets-bombers',
      gender: 'UNISEX',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?w=900&auto=format&fit=crop&q=80',
          altText: 'Structured Boxy Flight Bomber Jacket',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-OUT-BMB-BLK-M', color: 'Tactical Black', colorCode: '#111111', size: 'M', stock: 12 },
        { sku: 'ZEV-OUT-BMB-BLK-L', color: 'Tactical Black', colorCode: '#111111', size: 'L', stock: 15 },
      ],
    },
    {
      title: 'Vintage Washed Canvas Distressed Dad Cap',
      slug: 'vintage-washed-canvas-distressed-dad-cap',
      description:
        'Unstructured 6-panel cap crafted from enzyme-washed heavyweight cotton canvas with tonal ZEVON embroidery.',
      details: 'Curved visor, adjustable antique brass buckle strap.',
      fabricSpecs: '100% Heavy Enzyme-Washed Cotton Canvas.',
      washCare: 'Spot clean only.',
      tags: ['Cap', 'Headwear', 'Accessories', 'Vintage'],
      basePrice: 950,
      discountPrice: null,
      categorySlug: 'caps-headwear',
      gender: 'UNISEX',
      season: 'SS/26',
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&auto=format&fit=crop&q=80',
          altText: 'Vintage Washed Canvas Cap',
          isPrimary: true,
        },
      ],
      variants: [
        { sku: 'ZEV-ACC-CAP-WAS-OS', color: 'Washed Charcoal', colorCode: '#404040', size: 'OS', stock: 50 },
      ],
    },
  ];

  for (const pSeed of productSeeds) {
    const { categorySlug, images, variants, ...prodData } = pSeed;

    const cat = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!cat) continue;

    const existingProduct = await prisma.product.findUnique({
      where: { slug: prodData.slug },
    });

    if (existingProduct) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          ...prodData,
          categoryId: cat.id,
        },
      });
    } else {
      const createdProd = await prisma.product.create({
        data: {
          ...prodData,
          categoryId: cat.id,
        },
      });

      // Insert images
      for (let i = 0; i < images.length; i++) {
        const img = images[i]!;
        await prisma.productImage.create({
          data: {
            productId: createdProd.id,
            url: img.url,
            altText: img.altText,
            isPrimary: img.isPrimary,
            sortOrder: i,
          },
        });
      }

      // Insert variants
      for (const v of variants) {
        await prisma.productVariant.upsert({
          where: { sku: v.sku },
          update: {
            color: v.color,
            colorCode: v.colorCode,
            size: v.size,
            stock: v.stock,
          },
          create: {
            productId: createdProd.id,
            sku: v.sku,
            color: v.color,
            colorCode: v.colorCode,
            size: v.size,
            stock: v.stock,
          },
        });
      }
    }
  }

  // Create sample verified customer users for authentic product reviews
  const customerSeeds = [
    { email: 'tanvir@example.com', name: 'Tanvir Ahmed', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
    { email: 'nafis@example.com', name: 'Nafis Fuad', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
    { email: 'sumaiya@example.com', name: 'Sumaiya Rahman', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
    { email: 'abrar@example.com', name: 'Abrar Chowdhury', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  ];

  const customers: any[] = [];
  for (const c of customerSeeds) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: { name: c.name, avatarUrl: c.avatarUrl },
      create: {
        email: c.email,
        name: c.name,
        avatarUrl: c.avatarUrl,
        password: hashedPassword,
      },
    });
    customers.push(user);
  }

  // Seed verified customer reviews for each product
  const allDbProducts = await prisma.product.findMany();
  const sampleReviewTemplates = [
    {
      rating: 5,
      comment:
        'The fabric weight is unmatched! Definitely a true 380+ GSM. The boxy drape sits perfectly on shoulders. Highly recommended for streetwear lovers in Dhaka.',
    },
    {
      rating: 5,
      comment:
        'Best streetwear piece I have bought in Bangladesh. Minimalist cut with zero loose threads and the loopback cotton fleece feels ultra premium.',
    },
    {
      rating: 5,
      comment:
        'Love the fit and the heavy texture! Fast delivery within 24 hours in Dhanmondi. Will order more from the SS/26 drop.',
    },
    {
      rating: 4,
      comment:
        'Solid construction and great packaging with custom ZEVON dust bag. Fits true to size for an architectural oversized look.',
    },
  ];

  for (const prod of allDbProducts) {
    for (let i = 0; i < customers.length; i++) {
      const cust = customers[i]!;
      const tpl = sampleReviewTemplates[i % sampleReviewTemplates.length]!;

      await prisma.review.upsert({
        where: {
          userId_productId: {
            userId: cust.id,
            productId: prod.id,
          },
        },
        update: {
          rating: tpl.rating,
          comment: tpl.comment,
          isVerifiedPurchase: true,
        },
        create: {
          userId: cust.id,
          productId: prod.id,
          rating: tpl.rating,
          comment: tpl.comment,
          isVerifiedPurchase: true,
          images: [],
        },
      });
    }
  }

  console.log(`✅ Default products seeded (${productSeeds.length} products with variants, galleries, and verified customer reviews)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
