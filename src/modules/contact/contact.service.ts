import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateContactDto, SubscribeNewsletterDto } from './dto/index.js';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public: Submit a contact message / customer inquiry
   */
  async submitContactMessage(createContactDto: CreateContactDto) {
    const { name, email, phone, subject, message } = createContactDto;

    const contactMessage = await this.prisma.contactMessage.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        subject: subject ? subject.trim() : 'General Inquiry',
        message: message.trim(),
      },
    });

    this.logger.log(`New contact message received from ${email} (${contactMessage.id})`);

    return {
      id: contactMessage.id,
      name: contactMessage.name,
      email: contactMessage.email,
      subject: contactMessage.subject,
      createdAt: contactMessage.createdAt,
      message: 'Thank you for contacting ZEVON. Our atelier team will get back to you shortly.',
    };
  }

  /**
   * Public: Subscribe to the ZEVON private archive & newsletter
   */
  async subscribeNewsletter(subscribeNewsletterDto: SubscribeNewsletterDto) {
    const email = subscribeNewsletterDto.email.trim().toLowerCase();

    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { isActive: true },
      create: {
        email,
        isActive: true,
      },
    });

    this.logger.log(`Newsletter subscription registered for ${email}`);

    return {
      email: subscriber.email,
      subscribedAt: subscriber.subscribedAt,
      promoCode: 'ZEVON10',
      discountPercent: 10,
      message: 'Welcome to the ZEVON Archive! Use promo code ZEVON10 for 10% off your first order.',
    };
  }

  /**
   * Admin: List contact messages with pagination, search, and isRead filtering
   */
  async findAllMessages(
    page: number = 1,
    limit: number = 20,
    isRead?: boolean,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (typeof isRead === 'boolean') {
      where.isRead = isRead;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactMessage.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Mark a message as read
   */
  async markAsRead(id: string) {
    const exists = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Contact message with ID ${id} not found`);
    }

    return this.prisma.contactMessage.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Admin: Delete a contact message
   */
  async deleteMessage(id: string) {
    const exists = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Contact message with ID ${id} not found`);
    }

    await this.prisma.contactMessage.delete({ where: { id } });
    return { message: 'Contact message deleted successfully' };
  }

  /**
   * Admin: List newsletter subscribers
   */
  async findAllSubscribers(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        skip,
        take: limit,
        orderBy: { subscribedAt: 'desc' },
      }),
      this.prisma.newsletterSubscriber.count(),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
