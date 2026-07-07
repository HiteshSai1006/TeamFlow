# TeamFlow Architecture and Design Decisions

## 1. Purpose and Context
TeamFlow provides a unified software‑engineering platform for collaborative task, issue and root‑cause‑analysis (RCA) management. The system prioritises:
- **Consistency** – a single source of truth for projects, tasks, and RCAs.
- **Traceability** – immutable activity logs, outbox events and audit‑ready data.
- **Maintainability** – clear domain boundaries, typed Prisma models and explicit migrations.
- **Appropriate MVP complexity** – a modular monolith that delivers core workflow without unnecessary distributed overhead.
- **Future extensibility** – designed to evolve toward offline‑first or multi‑region deployments.

## 2. Modular Monolith over Microservices
**Decision:** Implement a feature‑based modular monolith.
**Alternatives considered:** Separate micro‑service per domain (tasks, RCAs, notifications) using a service mesh.
**Rationale:** The MVP required fast iteration and transactional consistency across domains (e.g., creating a task and its activity log). A monolith keeps all Prisma models in one schema, enabling ACID transactions and simplifying deployment.
**Trade‑offs:** Loss of independent scaling per domain, but gains in operational simplicity and lower latency.

## 3. PostgreSQL over NoSQL
**Decision:** Use PostgreSQL with Prisma ORM.
**Alternatives considered:** Document stores (MongoDB) or key‑value stores.
**Rationale:** The domain model relies heavily on relational integrity – foreign keys, cascade deletes, many‑to‑many relations (project members, task relations) and complex queries (hierarchy traversal, dependency cycles). PostgreSQL provides robust constraints, transactions and advisory locks used for cycle detection.
**Trade‑offs:** Less flexible schema evolution than schemaless stores, but schema‑driven development improves data integrity and query performance.

## 4. Prisma ORM and Migration‑Based Schema Management
**Decision:** Prisma ORM with migration‑driven schema evolution.
**Alternatives considered:** Hand‑written SQL scripts, query‑builder libraries (Knex).
**Rationale:** Prisma provides a generated client and schema-driven database access, while migration files stored in `server/prisma/migrations/` make database evolution reproducible across environments.
**Trade‑offs:** Slight learning curve vs raw SQL, but benefits outweigh the cost for a team‑centric product.

## 5. Synchronous REST with Event‑Driven Side Effects
**Decision:** Core actions are handled via synchronous REST endpoints; secondary effects are emitted as immutable events stored in `EventOutbox`.
**Alternatives considered:** Full message‑broker architecture (Kafka, RabbitMQ) for all flows.
**Rationale:** Immediate user feedback is critical for task updates. An outbox pattern decouples notifications (emails, in‑app alerts) without the operational overhead of a broker.
**Trade‑offs:** Slight latency for side‑effects; future migration to a broker is straightforward.

## 6. Task Dependency and Hierarchy Modelling
**Decision:** Model dependencies with `TaskRelation` (directed `BLOCKS` edges) and hierarchy with a self‑referencing `parentId`.
**Alternatives considered:** Adjacency list only, materialised path, or graph databases.
**Rationale:** The relational model supports project‑scoped dependencies, prevents self‑dependencies, and uses a BFS traversal with PostgreSQL advisory locks to detect cycles before insertion. Duplicate relations are prevented by a unique constraint on `(sourceTaskId, targetTaskId)`.
**Trade‑offs:** Requires explicit cycle‑check logic; however it keeps everything inside the monolith and leverages existing transaction guarantees.

## 7. Controlled Task Lifecycle
**Decision:** Enforce a controlled transition matrix for `TaskStatus` with explicit validation:
- TODO → IN_PROGRESS
- IN_PROGRESS → TODO, BLOCKED, or DONE
- BLOCKED → IN_PROGRESS or TODO
- DONE → IN_PROGRESS
This supports rollback and reopening while rejecting invalid direct jumps.
**Alternatives considered:** Free‑form status strings.
**Rationale:** Guarantees predictable workflow and simplifies audit logging; unrestricted status changes were rejected to maintain data integrity.
**Trade‑offs:** Slight rigidity but aligns with engineering best practices.

## 8. Role‑Based Authorization
**Decision:** System‑wide roles (`ADMIN`, `MEMBER`) and per‑project roles (`MANAGER`, `MEMBER`, `REVIEWER`).
**Alternatives considered:** Granular per‑resource permissions.
**Rationale:** The implementation stores roles in `User.systemRole` and `ProjectMember.role`, with middleware enforcing checks. This balances security with simplicity for the MVP.
**Trade‑offs:** Less fine‑grained control; additional permissions can be layered later.

## 9. Transactional Outbox and Notification Reliability
**Decision:** Use `EventOutbox` for immutable business events and `Notification` for user‑visible messages.
**Alternatives considered:** Direct email sending within request handling.
**Rationale:** Outbox entries are written in the same transaction as the business operation, guaranteeing eventual delivery. Deduplication keys prevent duplicate notifications; email retries are tracked via `EmailDeliveryState`.
**Trade‑offs:** Added processing component, but improves reliability and decouples delivery failures from core logic.

## 10. File Storage Strategy
**Decision:** Store uploaded attachments on the local filesystem (`uploads/`) with metadata in PostgreSQL.
**Alternatives considered:** Storing binary blobs in the database or using cloud object storage.
**Rationale:** Simplicity for the MVP; files are referenced by a unique `storageKey`. Database BLOBs would bloat the DB, and external storage introduces external service dependencies.
**Trade‑offs:** Limited scalability; migration path to S3 or similar is outlined in future work.

## 11. Atomic Writes, Auditability, and Historical Integrity
**Decision:** Wrap all mutating operations in Prisma transactions; never delete tasks.
**Alternatives considered:** Soft‑delete flags.
**Rationale:** Transactions guarantee atomicity across `Task`, `ActivityLog`, and `EventOutbox`. Archiving a project makes it read‑only but retains all historical data, preserving review rounds and RCA decisions.
**Trade‑offs:** Larger tables over time; acceptable for the intended usage.

## 12. Future Evolution
- **Offline‑first**: Sync‑able client stores and conflict‑resolution queues.
- **Compliance**: Exportable audit logs, GDPR‑compliant data‑erasure workflows.
- **High scale**: Sharding PostgreSQL, moving to a message broker for outboxes.
- **Low‑cost deployment**: Container‑orchestration on cheaper VM instances.
- **Multi‑region**: Read‑replicas with eventual‑consistent event processing.

*All decisions reflect the current implementation in `server/prisma/schema.prisma`, service code, and migration scripts.*
