# BudgetPlanner Security Specification (Phase 0)

## 1. Data Invariants
1. All personal financial data (`/users/{userId}` and all subcollections `/categories`, `/transactions`, `/recurringRules`, `/savingsGoals`, `/debts`) is strictly private to the authenticated, email-verified owner (`request.auth.uid == userId`).
2. Subcollection documents cannot exist without a valid parent `/users/{userId}` document (verified on write via Master Gate `exists()`).
3. Owner identity (`uid`, `ownerId`) and creation timestamps (`createdAt`) are immutable after creation and must match `request.auth.uid` and `request.time`.
4. All document IDs (`userId`, `categoryId`, `transactionId`, `ruleId`, `goalId`, `debtId`) must match `^[a-zA-Z0-9_\-]+$` with max length 128.
5. Every string has explicit `.size()` bounds; every array (`generatedPeriods`, `contributions`, `payments`) has strict `.size()` upper bounds and element type validation.
6. No unvalidated shadow fields: every `create` validates exact `keys().hasAll(...)` and `keys().hasOnly(...)`, and every `update` uses action-based `affectedKeys().hasOnly(...)` combined with full `isValid[Entity](incoming())`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-User Read**: User B (`uid: "user-b"`) tries `get` or `list` on `/users/user-a/transactions`.
2. **Identity Spoofing on Create**: User A writes `/users/user-a/transactions/tx1` with `ownerId: "user-b"`.
3. **Orphan Subcollection Write**: User A writes `/users/user-a/transactions/tx1` before `/users/user-a` exists.
4. **Shadow / Ghost Field Injection**: User A creates `/users/user-a` with an extra field `isAdmin: true` or `role: "admin"`.
5. **Unverified Email Bypass**: Authenticated request with `request.auth.token.email_verified == false` attempts to write to `/users/user-a`.
6. **ID Poisoning**: User A writes `/users/user-a/transactions/` with a 1500-char ID or invalid characters (`../admin`).
7. **Immutable Field Mutation**: User A updates `/users/user-a/transactions/tx1` attempting to change `ownerId` or `createdAt`.
8. **Client Timestamp Spoofing**: User A creates a transaction with `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
9. **Negative / Zero Amount Poisoning**: User A creates a transaction with `amount: -500` or `amount: 0`.
10. **Value Type Poisoning on Update**: User A updates `/users/user-a` setting `monthlyLimit: "unlimited"` or `monthlyLimit: 999999`.
11. **Unbounded Array Exhaustion**: User A updates `/users/user-a/savingsGoals/g1` with `contributions` array containing > 200 items or invalid element shape.
12. **Blanket List Query Scraping**: Any user attempts `list` on `/users` collection or `/users/user-b/savingsGoals`.
