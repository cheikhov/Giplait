# Security Specification — GESTION DE STOCK – CHEF DE QUAI

## 1. Data Invariants
1. Unauthenticated or unverified users (`request.auth == null || request.auth.token.email_verified != true`) have zero read or write access to any collection.
2. Users cannot self-assign `admin` or `chef_de_quai` roles on `/users/{userId}` creation; new profiles are restricted to `role == 'operateur'` unless created by a verified Admin.
3. Users cannot read other users' PII (`email`) unless they are Admin.
4. `StockMovement`, `DeliveryDocument`, and `GlobalInventory` records are immutable once confirmed/validated (`allow update, delete: if false` for non-admin, preserving audit integrity).
5. Every `create` payload must validate `createdByUid == request.auth.uid` (or `userUid == request.auth.uid`), exact key allowlists (`hasAll` + `hasOnly`), string `.size()` bounds, numeric bounds (`currentStock >= 0`), and `createdAt == request.time`.
6. Document IDs must strictly match `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
7. `allow list` rules explicitly verify `resource.data.workspaceId == 'giplait-main'` (or `resource.data.uid == request.auth.uid` on `/users`) without invoking `get()`/`exists()` inside list rules.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Product Read**: `get(/products/prod-1)` with `auth == null` -> DENIED.
2. **Unverified Email Write**: `create(/products/prod-1)` with `email_verified: false` -> DENIED.
3. **Self-Assigned Admin Escalation**: `create(/users/u1, { ..., role: 'admin' })` by non-admin -> DENIED.
4. **Role Escalation via Update**: `update(/users/u1, { role: 'chef_de_quai' })` by non-admin -> DENIED.
5. **PII Leak on Users**: `get(/users/otherUid)` by non-admin -> DENIED.
6. **Shadow Field Injection on Product**: `create(/products/p1, { ..., isAdminOverride: true })` -> DENIED (`hasOnly` rejects unknown key).
7. **Negative Stock Creation**: `create(/products/p1, { ..., currentStock: -50 })` -> DENIED.
8. **Forged Movement Author**: `create(/movements/m1, { ..., userUid: 'someone-else' })` -> DENIED.
9. **Client-Forged Timestamp**: `create(/movements/m1, { ..., createdAt: Timestamp(2020-01-01) })` -> DENIED (`createdAt == request.time`).
10. **Movement History Tampering**: `update(/movements/m1, { quantity: 9999 })` -> DENIED (immutable ledger).
11. **ID Poisoning Attack**: `create(/products/invalid$$$id_exceeding_128_chars...)` -> DENIED (`isValidId` rejects).
12. **Type Poisoning on Product Update**: `update(/products/p1, { currentStock: "9999" })` -> DENIED (`isValidProduct` rejects non-number).
