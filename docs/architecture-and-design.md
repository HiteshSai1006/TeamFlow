# TeamFlow Architecture and Design

## 1. System Context

TeamFlow is a collaborative software-engineering portal designed to manage projects, coordinate tasks, and facilitate structured Root-Cause Analysis (RCA) within engineering teams. The platform addresses several critical software-engineering challenges:

* **Consistency**: Ensuring a single unified database schema with clear relationships and state integrity across users, projects, tasks, and RCAs.
* **Traceability**: Providing audit-ready historical context via transactional activity logging and reliable event outbox delivery tracking.
* **Maintainability**: Structuring backend modules into logical domain folders to minimize coupling and maximize code readability.
* **MVP-appropriate complexity**: Using a feature-based modular monolith to avoid the operational overhead of microservices, while structuring domain layers to allow future separation.
* **Future extensibility**: Constructing data contracts and database schemas that allow integration with real mail transporters, cloud object stores, or messaging middleware.

---

## 2. System Architecture

The overall system structure follows a synchronous REST API pattern for user interactions combined with an asynchronous event outbox processing loop.

```text
User Actions Flow:
User -> React + Vite Frontend -> REST API -> Express Routes -> Authentication and Authorization -> Domain Modules -> Business Rule Validation -> Prisma ORM -> PostgreSQL

Asynchronous Notification Flow:
Business Action -> EventOutbox -> Notification Worker -> In-App Notification -> Mock Email Delivery / Retry
```

### Reference Diagram
`diagrams/system-architecture.png` (Visual representation of the user action flow and asynchronous background worker cycle)

### Architectural Choice: Modular Monolith vs Microservices
* **Decision**: Implement the backend as a single Express-based application with logical domain boundaries under `server/src/modules/` (e.g., auth, task, rca, notification).
* **Alternatives considered**:
  * **Microservices**: Distributing tasks, RCAs, and notifications into separate services communicating via gRPC or HTTP.
  * **Serverless Functions**: Implementing each route as an isolated function handler.
* **Rationale**: A modular monolith allows the MVP to share a single database connection and transaction boundary (Prisma transaction), making multi-model updates atomic and simple. It minimizes local environment setup overhead and simplifies deployment.
* **Trade-offs**: If a specific module (e.g., notification processing) experiences a memory leak or CPU overload, it impacts the entire Express server. Additionally, scale-out requires scaling the entire process rather than specific high-demand components.

---

## 3. Domain Model and ERD

The database layer utilizes PostgreSQL, mapped through Prisma ORM.

### Reference Diagram
`diagrams/erd-domain-model.png` (Visual ERD showing primary key relations and unique constraints)

### Major Domain Entities and Relationships
* **User**: System accounts with a system-wide role (`ADMIN`, `MEMBER`). Associated with custom UserPreferences (theme, email opt-out) and ProjectMemberships.
* **Project**: Containers for tasks, members, and RCAs. Has an active status (`ACTIVE`, `ARCHIVED`) and is managed by assigned members.
* **ProjectMember**: Maps Users to Projects with project-scoped roles (`MANAGER`, `MEMBER`, `REVIEWER`). Unique constraint enforces single membership per user per project.
* **Task**: Core unit of work containing title, description, priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), status (`TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`), and assignee relationships.
* **TaskRelation**: Represents directed task dependencies where one task blocks another. The type is hardcoded to `BLOCKS`.
* **Task Hierarchy**: Represented by a self-referencing relationship where a task has a nullable `parentId` pointing to its parent Task.
* **RCA**: Root-Cause Analysis documents containing multiple structured RCASections, reviewed in sequential review rounds by assigned Project REVIEWERs.
* **Review**: Individual decisions (`PENDING`, `APPROVED`, `REJECTED`) within a specific RCA review round.
* **EventOutbox & Notification**: Audit logs and notification records that power internal alerts and simulated email transmissions.

### Integrity Rules and Scoping
* **Project-scoped Dependencies**: Task dependencies are strictly project-scoped. The service layer verifies that both source and target tasks belong to the same project ID. Cross-project task dependencies are invalid and rejected.
* **Project-scoped Hierarchy**: A child task must belong to the same project as its parent. The parent-child linkage is strictly project-scoped.

---

## 4. API and Service Interaction

Client interactions are standard REST API requests that process through middleware, validation, service business logic, and transactional writes.

```text
Request Lifecycle:
User Action -> React Feature -> REST API Route -> Authentication -> Authorization -> Domain Service -> Business Rule Validation -> Prisma Transaction (if multi-model write) -> PostgreSQL -> Activity/Outbox Event -> JSON Response
```

### Reference Diagram
`diagrams/api-service-flow.png` (Interaction sequence from user click to database write and event emission)

* **Authentication**: Enforced via JWT tokens carried in secure HttpOnly cookies.
* **Authorization**: Middleware inspects `User.systemRole` or queries the `ProjectMember` table for the user's project-specific role before allowing request entry.
* **Validation**: Service methods execute cycle checks, status checks, and project boundaries before executing queries.
* **Atomicity**: Critical state updates (e.g., adding task dependencies or updating tasks) use Prisma transactions to bundle database modifications with activity log and outbox event writes.

---

## 5. Notification and Event Flow

Asynchronous notification distribution is decoupled from user request threads via an outbox worker pattern.

```text
Event & Email Processing:
Business operation write -> EventOutbox (PENDING) -> Outbox Worker (SKIP LOCKED) -> Process & Fan out -> Notification (PENDING) -> Email Worker (SKIP LOCKED) -> Simulated Delivery
```

### Reference Diagram
`diagrams/notification-flow.png` (Event-outbox processing loop, email delivery queue, opt-out check, and worker retries)

### Core Mechanics
1. **Outbox Writing**: Mutating services (like task status modifications or RCA submission) write an event payload to `EventOutbox` within their core transaction.
2. **Outbox Worker**: Polling every 3 seconds, the worker claims up to 10 `PENDING` outbox rows using raw SQL: `UPDATE "EventOutbox" SET "processingState" = 'PROCESSING' WHERE id IN (...) FOR UPDATE SKIP LOCKED RETURNING ...`. This ensures multiple worker instances do not process the same rows.
3. **Notification Fan-out**: The worker generates a `Notification` for each calculated recipient (excluding the actor). The `dedupKey` (`event:<eventId>:recipient:<recipientId>`) combined with a database unique constraint and Prisma `createMany(skipDuplicates: true)` prevents duplicate alerts.
4. **Email Delivery**: The email worker polls `PENDING` notifications using `SKIP LOCKED`. It queries `UserPreference.emailOptOut`. If true, the status becomes `SKIPPED_OPT_OUT`. Otherwise, it logs details to `/server/uploads/mock_emails.log` (in development) or prints to stdout.
5. **Retry Logic**: Failed email attempts increment the retry counter. It is retried up to 3 times before transitioning to `FAILED`. A stale recovery worker resets any items stuck in `PROCESSING` for more than 5 minutes back to `PENDING`.

---

## 6. RCA Review Flow

The Root-Cause Analysis workflow is a structured process designed to transition through explicit states under reviewer control.

```text
RCA State Transitions:
DRAFT -> (Submit RCA) -> UNDER_REVIEW -> (Reviewer Reject) -> REJECTED -> (Reopen RCA) -> DRAFT (round incremented)
UNDER_REVIEW -> (All Reviewers Approve) -> APPROVED -> (Close RCA) -> CLOSED (terminal)
```

### Reference Diagram
`diagrams/rca-review-flow.png` (Visual state transition diagram for the RCA lifecycle)

### Transition Validation Rules
* **Create RCA**: Initializes an RCA with status `DRAFT` and `reviewRound = 1`.
* **Section Editing**: RCASections can only be modified while the RCA is in `DRAFT`.
* **Submit for Review**: Transitions status from `DRAFT` to `UNDER_REVIEW`. This creates `PENDING` `Review` rows for the current round assigned to designated reviewers.
* **Review decision**: Reviewers submit decisions (`APPROVED` or `REJECTED`) with a required comment.
  * **First-Rejection-Wins**: The moment any reviewer submits `REJECTED`, the RCA status instantly transitions to `REJECTED` (remaining reviews in the round are bypassed).
  * **Unanimous Approval**: The RCA transitions to `APPROVED` only when every assigned review for the current round is `APPROVED`.
* **Reopen RCA**: Transitions status from `REJECTED` to `DRAFT`. This increments the `reviewRound` by 1. Re-submitting creates a new set of `PENDING` reviews for the new round, preserving past rounds as historical audit logs.
* **Close RCA**: Transitions status from `APPROVED` to `CLOSED`. This action is restricted to project `MANAGER`s only. `CLOSED` is a terminal state.

---

## 7. Major Design Decisions

### 1. Modular Monolith over Microservices
* **Decision**: Implement a modular monolith within a single Express app and directory structure.
* **Alternatives considered**: Separate microservices for tasks, notifications, and RCAs.
* **Rationale**: Guarantees ACID database transactions across domains and reduces operational overhead.
* **Trade-offs**: Shared hardware resources; high memory usage in one domain affects others.

### 2. PostgreSQL over NoSQL
* **Decision**: Use PostgreSQL as the relational datastore.
* **Alternatives considered**: MongoDB (Document store), Redis (Key-value).
* **Rationale**: Strong foreign key constraints and relations (many-to-many project members, task relations) are necessary to prevent orphaned data.
* **Trade-offs**: Schema migrations must be explicitly run, making updates less flexible than a schemaless datastore.

### 3. Prisma ORM over raw SQL / query builders
* **Decision**: Use Prisma ORM to manage query execution and schema migrations.
* **Alternatives considered**: Hand-written SQL, Knex query builder.
* **Rationale**: Speeds up development, provides database-agnostic schema syntax, and simplifies complex queries via schema relations.
* **Trade-offs**: Adds dependency size and runtime overhead compared to native SQL drivers.

### 4. Synchronous REST with Event-driven Side Effects
* **Decision**: Expose REST endpoints for primary actions, while secondary operations (notifications) are asynchronous via `EventOutbox`.
* **Alternatives considered**: Synchronous emails during web requests, external message brokers (RabbitMQ).
* **Rationale**: Fast REST responses for users; the transactional outbox ensures notification delivery without the complexity of message brokers.
* **Trade-offs**: Introduce background polling latency (3 seconds) for alerts.

### 5. TaskRelation Dependency Model
* **Decision**: Model blocking task dependencies in a dedicated `TaskRelation` table with a `BLOCKS` type.
* **Alternatives considered**: Storing blocked task IDs in an array within the Task table.
* **Rationale**: Normalizes relationships, supports indexing, and permits easy validation of cycles via target-to-source BFS traversal.
* **Trade-offs**: Requires joining tables to load task dependency details.

### 6. Self-referencing Task Hierarchy
* **Decision**: Model subtasks using a single nullable self-referencing `parentId` column on the `Task` model.
* **Alternatives considered**: Adjacency lists, materialized paths.
* **Rationale**: Simplifies parent-child associations and leverages standard relation hooks. Ancestry-walk cycle detection ensures a task is never its own ancestor.
* **Trade-offs**: Deep nested queries require recursive lookups.

### 7. Controlled Task Lifecycle
* **Decision**: Enforce a strict state machine transition matrix:
  * TODO -> IN_PROGRESS
  * IN_PROGRESS -> TODO, BLOCKED, or DONE
  * BLOCKED -> IN_PROGRESS or TODO
  * DONE -> IN_PROGRESS
* **Alternatives considered**: Open string statuses (free-form movement).
* **Rationale**: Enforces project tracking discipline and prevents invalid state progression.
* **Trade-offs**: Rigid lifecycle; users must revert back to IN_PROGRESS if they need to change a DONE task.

### 8. Role-based Authorization
* **Decision**: System roles (`ADMIN`, `MEMBER`) and project-scoped roles (`MANAGER`, `MEMBER`, `REVIEWER`).
* **Alternatives considered**: Granular attribute-based authorization (ABAC).
* **Rationale**: Standard role assignments simplify access control and fit the requirements perfectly.
* **Trade-offs**: Lacks granular capability-based assignments.

### 9. Transactional Outbox
* **Decision**: Write outbox events in the same database transaction as the primary model change.
* **Alternatives considered**: Emitting events in memory post-commit.
* **Rationale**: Prevents partial failure scenarios where a task status updates but the event is lost due to a server crash.
* **Trade-offs**: Adds additional write query inside the critical request transaction.

### 10. Local File Storage for MVP
* **Decision**: Store uploaded attachment files on the local filesystem path `uploads/`.
* **Alternatives considered**: Database BLOBs, AWS S3 object store.
* **Rationale**: Removes external cloud dependencies for local setups while maintaining a clean schema with file size and mime limits.
* **Trade-offs**: Server filesystem storage restricts multi-instance scaling.

### 11. Atomic Writes and Audit History
* **Decision**: Execute multi-model state changes inside database transactions.
* **Alternatives considered**: Application-level sequential writes.
* **Rationale**: Ensures that if a task assignment changes, both the task record updates and the `ActivityLog` is written, maintaining historical audit logs.
* **Trade-offs**: Increases database connection lock times.

### 12. No Task Hard Deletion
* **Decision**: Exclude hard-deletion routes for tasks.
* **Alternatives considered**: Cascade deleting task rows.
* **Rationale**: Preserves activity records, comments, and RCA links, protecting historical project audit trails.
* **Trade-offs**: Accumulates data over time in the database tables.

---

## 8. Future Evolution

These outlines describe potential future system designs, not currently implemented features:

* **Offline-first Use**: Implementing a service worker with IndexedDB on the frontend to cache tasks, queue mutating actions locally, and process sync states using vector clocks.
* **Compliance**: Developing automated exports for GDPR right-to-be-forgotten requests, hashing private data, and creating read-only immutable logging archives.
* **High Scale**: Moving event outboxes to Apache Kafka or RabbitMQ, sharding PostgreSQL by project ID, and caching task records in Redis.
* **Low Cost**: Deploying the monolith on containerized hosts (like AWS Fargate or VPS instances) using shared PostgreSQL instances.
* **Multi-region Deployment**: Utilizing globally distributed databases (such as CockroachDB) and regional edge proxies to route traffic to local instances.
