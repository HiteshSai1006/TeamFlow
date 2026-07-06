# ADR 003 — Transactional Event Outbox and Email Worker

## Status
Accepted

## Context
Triggering in-app alerts and processing email notifications during synchronous HTTP request-response lifecycles introduces performance bottlenecks, risk of data loss on network drops, and potential for duplicate deliveries.

## Decision
We decouple notification delivery into an asynchronous event worker queue pipeline using an append-only `EventOutbox` and transactional notification claiming.

### Design Details
1. **Outbox Pattern**: Business mutations insert event payloads directly into `EventOutbox` within the database transaction scope, eliminating dual-write failure states.
2. **Concurrent Workers**: The email background worker polls `EventOutbox` and `Notification` tables using CTE queries:
   ```sql
   UPDATE "Notification" SET ...
   WHERE id IN (
     SELECT id FROM "Notification"
     WHERE "emailState" = 'PENDING' AND "emailAttempts" < 3
     FOR UPDATE SKIP LOCKED
   )
   ```
   `SKIP LOCKED` allows multiple backend instances to claim distinct notification records concurrently without locking issues.
3. **Idempotency & Suppressions**: Unique database indexes on the `dedupKey` column in the `Notification` table prevent duplicate alert dispatches automatically.
4. **Preference Checks**: Before writing email log files, the worker verifies the user's `emailOptOut` status from the `UserPreference` table to honor opt-out constraints.
