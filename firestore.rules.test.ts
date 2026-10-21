/**
 * Firestore Security Rules Test Suite for SGHS-23 Cricket Tournament Season 2
 * Verifies that all Dirty Dozen adversarial payloads return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'delete' | 'list' | 'get';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated tournament creation',
    operation: 'create',
    path: '/tournaments/sghs23_season2',
    auth: null,
    payload: { title: 'SGHS-23' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified admin email spoofing attack',
    operation: 'create',
    path: '/tournaments/sghs23_season2',
    auth: { uid: 'spoof_1', email: 'ridwanrifat13@gmail.com', email_verified: false },
    payload: { title: 'SGHS-23', ownerId: 'spoof_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Owner UID spoofing on create',
    operation: 'create',
    path: '/tournaments/sghs23_season2',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { title: 'SGHS-23', ownerId: 'other_user_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow field injection on update',
    operation: 'update',
    path: '/tournaments/sghs23_season2',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { title: 'SGHS-23', ownerId: 'user_1', isVerifiedShadow: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Path ID poisoning with invalid characters',
    operation: 'get',
    path: '/tournaments/invalid$id!with*spaces',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Oversized title string (>120 chars)',
    operation: 'update',
    path: '/tournaments/sghs23_season2',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { title: 'A'.repeat(250), ownerId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Unbounded players array (>30 players)',
    operation: 'update',
    path: '/tournaments/sghs23_season2',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { players: new Array(35).fill({ id: 'p1' }), ownerId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Forged client timestamp for updatedAt',
    operation: 'update',
    path: '/tournaments/sghs23_season2',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { updatedAt: '2020-01-01T00:00:00Z', ownerId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Mutating immutable createdAt field on update',
    operation: 'update',
    path: '/tournaments/sghs23_season2',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { createdAt: '2026-10-22T00:00:00Z', ownerId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Updating a tournament locked in terminal archived state',
    operation: 'update',
    path: '/tournaments/sghs23_season2',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { status: 'active', title: 'Reopened', ownerId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unauthorized update by non-owner non-admin user',
    operation: 'update',
    path: '/tournaments/sghs23_season2',
    auth: { uid: 'attacker_99', email: 'attacker@example.com', email_verified: true },
    payload: { title: 'Hijacked Tournament', ownerId: 'attacker_99' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Self-assigned admin creation in /admins',
    operation: 'create',
    path: '/admins/attacker_99',
    auth: { uid: 'attacker_99', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'attacker_99' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
