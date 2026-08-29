import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict endpoint access by user roles.
 *
 * @example
 * ```ts
 * @Roles(Role.ADMIN, Role.MANAGER)
 * @Get('admin/dashboard')
 * getDashboard() { ... }
 * ```
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
