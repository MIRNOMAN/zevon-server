import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AddressType, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateAddressDto, UpdateAddressDto } from './dto/index.js';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new address for the authenticated customer.
   * If isDefault is true or it's the first address of this type,
   * any existing default address of that type will be toggled to false.
   */
  async create(userId: string, createAddressDto: CreateAddressDto) {
    const addressType = createAddressDto.type ?? AddressType.SHIPPING;

    const existingCount = await this.prisma.address.count({
      where: {
        userId,
        type: addressType,
      },
    });

    // If it's the first address of this type, make it default automatically
    const shouldBeDefault =
      existingCount === 0 || createAddressDto.isDefault === true;

    if (shouldBeDefault) {
      return this.prisma.$transaction(async (tx) => {
        // Toggle all other addresses of this type to false
        await tx.address.updateMany({
          where: {
            userId,
            type: addressType,
          },
          data: {
            isDefault: false,
          },
        });

        // Create the new default address
        return tx.address.create({
          data: {
            ...createAddressDto,
            userId,
            type: addressType,
            isDefault: true,
          },
        });
      });
    }

    return this.prisma.address.create({
      data: {
        ...createAddressDto,
        userId,
        type: addressType,
        isDefault: false,
      },
    });
  }

  /**
   * List all addresses for the authenticated user, sorted by default status then creation time.
   */
  async findAll(userId: string, type?: AddressType) {
    return this.prisma.address.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get a single address by ID with ownership verification.
   */
  async findOne(userId: string, id: string, userRole?: Role) {
    const address = await this.prisma.address.findUnique({
      where: { id },
    });

    if (!address) {
      throw new NotFoundException(`Address with ID "${id}" not found`);
    }

    if (address.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to view this address',
      );
    }

    return address;
  }

  /**
   * Update an existing address with isDefault toggle handling.
   */
  async update(
    userId: string,
    id: string,
    updateAddressDto: UpdateAddressDto,
    userRole?: Role,
  ) {
    const address = await this.findOne(userId, id, userRole);
    const targetType = updateAddressDto.type ?? address.type;

    if (updateAddressDto.isDefault === true) {
      return this.prisma.$transaction(async (tx) => {
        // Toggle other addresses of the same type to non-default
        await tx.address.updateMany({
          where: {
            userId,
            type: targetType,
            id: { not: id },
          },
          data: {
            isDefault: false,
          },
        });

        return tx.address.update({
          where: { id },
          data: {
            ...updateAddressDto,
            isDefault: true,
          },
        });
      });
    }

    return this.prisma.address.update({
      where: { id },
      data: updateAddressDto,
    });
  }

  /**
   * Explicitly set an address as the default address for its type.
   */
  async setDefault(userId: string, id: string) {
    const address = await this.findOne(userId, id);

    return this.prisma.$transaction(async (tx) => {
      // Toggle all other addresses of this type to false
      await tx.address.updateMany({
        where: {
          userId,
          type: address.type,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });

      // Set current address as default
      return tx.address.update({
        where: { id },
        data: {
          isDefault: true,
        },
      });
    });
  }

  /**
   * Delete an address.
   * If the deleted address was the default, promote the latest remaining address of that type to default.
   */
  async remove(userId: string, id: string, userRole?: Role) {
    const address = await this.findOne(userId, id, userRole);

    return this.prisma.$transaction(async (tx) => {
      await tx.address.delete({
        where: { id },
      });

      // If deleted address was default, auto-promote next available address
      if (address.isDefault) {
        const nextAddress = await tx.address.findFirst({
          where: {
            userId,
            type: address.type,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (nextAddress) {
          await tx.address.update({
            where: { id: nextAddress.id },
            data: { isDefault: true },
          });
        }
      }

      return { deleted: true, id };
    });
  }
}
