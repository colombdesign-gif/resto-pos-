import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'waiter' | 'kitchen' | 'courier';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
