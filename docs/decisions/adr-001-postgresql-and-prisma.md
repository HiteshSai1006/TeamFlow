# ADR 001 — PostgreSQL and Prisma

## Status
Accepted

## Context
TeamFlow requires absolute relational consistency across projects, tasks, comments, RCAs, and notifications. Concurrency and transactional isolation are critical, especially during task hierarchy cycle validations and outbox claims.

## Decision
We utilize PostgreSQL 15 as the relational database engine and Prisma ORM as the primary interface client.

### Key Details
1. **Relational Consistency**: Strict foreign key constraints and index patterns mapped inside `schema.prisma`.
2. **Project Boundaries**: Project-scoped queries (`where: { projectId }`) prevent cross-tenant queries.
3. **Prisma Transactions**: Scoped actions (e.g. comment creation with mentions, subtask cycle checks) run inside Prisma `$transaction` clients (`tx`) to prevent database fragmentation.
4. **Migration Strategy**: Lightweight, declarative Prisma migration scripts applied incrementally (`npx prisma migrate deploy`).
