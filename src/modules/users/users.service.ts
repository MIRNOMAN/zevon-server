import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateProfileDto,
  ChangePasswordDto,
  UpdateRoleDto,
  UpdateStatusDto,
} from './dto/index.js';
import { BCRYPT_SALT_ROUNDS } from '../../common/constants/index.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user (admin provisioned).
   */
  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        role: createUserDto.role ?? Role.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get current authenticated user profile with addresses.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        _count: {
          select: {
            orders: true,
            reviews: true,
            wishlist: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return user;
  }

  /**
   * Update current user profile fields (name, phone, avatarUrl).
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    await this.findOne(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Change user password.
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.password,
    );

    if (!isMatch) {
      throw new UnauthorizedException('Current password does not match');
    }

    const newHashedPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: newHashedPassword,
        hashedRefreshToken: null, // Revoke active sessions for security
      },
    });

    return { changed: true };
  }

  /**
   * List all users with pagination and filters (Admin/Manager).
   */
  async findAll(page = 1, limit = 20, role?: Role, search?: string) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
      }),
    ]);

    return {
      users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single user by ID with addresses.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        addresses: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Update user details (Admin).
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update user role (Admin only).
   */
  async updateRole(id: string, updateRoleDto: UpdateRoleDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: { role: updateRoleDto.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }

  /**
   * Update user active status (Admin/Manager).
   */
  async updateStatus(id: string, updateStatusDto: UpdateStatusDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive: updateStatusDto.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });
  }

  /**
   * Delete user (Admin only).
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.user.delete({
      where: { id },
      select: {
        id: true,
        email: true,
      },
    });
  }
}
