import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares the permission(s) required to access a route. Permission keys use
 * the `resource:action` convention (e.g. 'fraud_case:assign', 'report:export').
 * Enforced by PermissionsGuard against the authenticated user's permission set.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
