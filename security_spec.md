# Security Specification — SGHS-23 Cricket Tournament Season 2

## 1. Data Invariants
1. **Default-Deny Catch-All**: Any path not explicitly matched under `/tournaments/{tournamentId}` or `/admins/{adminId}` is unconditionally denied (`allow read, write: if false;`).
2. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates its path ID via `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
3. **No Unfiltered List Queries**: Collection-wide `list` operations on `/tournaments` and `/admins` are strictly forbidden (`allow list: if false;`) because clients subscribe directly to the known tournament document `/tournaments/sghs23_season2` via `get`.
4. **Verified Identity & Ownership**: All writes (`create`, `update`, `delete`) require a signed-in user with a verified email (`request.auth != null && request.auth.token.email_verified == true`). Furthermore, `incoming().ownerId == request.auth.uid` is strictly enforced in `isValidTournament()`, and updates require `existing().ownerId == request.auth.uid || isAdmin()`.
5. **Strict Schema & Shadow-Field Prevention**: `isValidTournament(data)` enforces exact key sets using `data.keys().hasAll(...)` and `data.keys().hasOnly(...)`, string length bounds, integer bounds, and bounded list sizes (`players.size() <= 30`, `teams.size() <= 6`, `matches.size() <= 10`, `notifications.size() <= 60`).
6. **Temporal & Immutable Integrity**: `createdAt == request.time` on `create`, `createdAt == existing().createdAt` and `ownerId == existing().ownerId` on `update`, and `updatedAt == request.time` on both `create` and `update`.
7. **Terminal State Locking**: Once `existing().status == 'archived'`, no further updates are permitted unless `isAdmin()`.

## 2. The "Dirty Dozen" Payloads
1. **Payload 1 (Unauthenticated Write)**: Attempting to create `/tournaments/sghs23_season2` with `auth = null`.
2. **Payload 2 (Unverified Email Spoof)**: Attempting to write as `ridwanrifat13@gmail.com` with `email_verified: false`.
3. **Payload 3 (Owner Identity Spoofing)**: Authenticated user `user_abc` creating a tournament document with `ownerId: "user_xyz"`.
4. **Payload 4 (Shadow/Ghost Field Injection)**: Sending a valid tournament payload plus an undeclared field `"isHacked": true`.
5. **Payload 5 (ID Poisoning Attack)**: Creating a document with an invalid ID containing special characters or >128 characters.
6. **Payload 6 (Oversized String / Denial of Wallet)**: Setting `title` to a 5,000-character string (exceeding `maxLength: 120`).
7. **Payload 7 (Unbounded Array Injection)**: Sending `players` with 50 items (exceeding `players.size() <= 30`) or empty non-map items.
8. **Payload 8 (Timestamp Forgery)**: Supplying a past or future client timestamp for `createdAt` or `updatedAt` instead of `request.time`.
9. **Payload 9 (Immutable Field Mutation)**: Attempting to change `ownerId` or `createdAt` during an `update`.
10. **Payload 10 (Terminal State Bypass)**: Non-admin user attempting to update a tournament document whose `existing().status == 'archived'`.
11. **Payload 11 (Unauthorized Cross-User Update)**: Authenticated user `attacker_1` attempting to update a tournament owned by `organizer_1`.
12. **Payload 12 (Privilege Escalation on `/admins`)**: Non-admin user attempting to create or modify `/admins/attacker_1`.
