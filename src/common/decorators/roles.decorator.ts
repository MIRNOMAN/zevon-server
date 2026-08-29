import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

export type AllowedRole = Role | 'CUSTOMER' | 'ADMIN' | 'MANAGER';

/**
 * Decorator to restrict route access by user roles.
 * Supports both Prisma Role enum (Role.ADMIN) and string literals ('ADMIN', 'CUSTOMER', 'MANAGER').
 *
 * @example
 * ```ts
 * @Roles('ADMIN', 'MANAGER')
 * @Get('admin/metrics')
 * getMetrics() { ... }
 * ```
 */
export const Roles = (...roles: AllowedRole[]) => SetMetadata(ROLES_KEY, roles);
