# TeamFlow Architecture and Design

## System Context

TeamFlow is a modular monolith for collaborative project planning, task coordination, and structured root-cause analysis. It combines a React + Vite frontend, an Express backend, Prisma ORM, and PostgreSQL so teams can manage projects, tasks, comments, attachments, and RCA workflows in one system.

## System Architecture

The implementation uses a synchronous REST request path for user actions and an asynchronous transactional outbox pipeline for notification side effects. HTTP requests flow through Express routes, authentication and project-role middleware, domain services, and Prisma transactions before persisting data in PostgreSQL. When a mutation needs to notify users, the service writes an EventOutbox record in the same transaction and a background worker processes it later.

## Domain Model and ERD

The core model centers on users, projects, project members, tasks, task relations, ActivityLog, RCA, Review, EventOutbox, Notification, UserPreference, and ProjectViewPreference. Tasks support project-scoped dependencies and parent-child hierarchy; ActivityLog records the audit trail for task and dependency changes; EventOutbox stores durable notification events; and Notification captures fan-out delivery state.

Integrity rules are enforced in the service layer and schema:
- Task dependencies and parent-child links are project-scoped.
- Dependency cycles are prevented with a breadth-first traversal of the dependency graph.
- Task hierarchy cycles are prevented by walking ancestor links before updating a parent.
- RCA review state is driven by a strict round-based workflow.

## API and Service Interaction

Client actions are handled by REST endpoints under the Express modules in server/src/modules. Middleware enforces authentication and project-role checks, services implement state transitions and business rules, and Prisma transactions wrap multi-model writes. JWTs are issued as HttpOnly cookies named token and are validated by the auth middleware. File uploads are stored under the local uploads directory.

## Notification and Event Flow

Mutating services write EventOutbox rows in the same transaction as the primary change. A background notification worker polls every 3 seconds, claims up to 10 pending rows with SELECT ... FOR UPDATE SKIP LOCKED, and fan-outs notifications. A second worker performs the same pattern for pending notifications, checks user email preferences, and records delivery outcome. Retry is limited to three attempts; stale PROCESSING rows older than five minutes are reset to PENDING by a recovery loop.

## RCA Review Flow

RCA creation starts in DRAFT with reviewRound = 1. Sections can only be edited while the RCA remains DRAFT. Submission moves the RCA to UNDER_REVIEW and creates pending review rows for the selected reviewers. Each review requires a non-empty comment; a single REJECTED decision immediately marks the RCA REJECTED, while approval requires all reviews for the current round to be approved. Reopening a REJECTED RCA returns it to DRAFT and increments the review round, and closing an APPROVED RCA is restricted to project MANAGERS.

## Major Design Decisions

- Modular Monolith over Microservices: one Express application with domain modules keeps transactions simple and avoids cross-service coordination.
- PostgreSQL over NoSQL: relational constraints fit project membership, task dependencies, and audit history well.
- Prisma ORM: Prisma provides a typed data layer and schema migrations for the application.
- Synchronous REST with Asynchronous Side Effects: user-facing requests stay fast while notifications are processed out of band.
- Transactional Outbox: event records are written with the core mutation so notification delivery is not lost on partial failure.
- Task Dependency Model: explicit BLOCKS relations make dependencies queryable and enforce cycle checking.
- Self-Referencing Task Hierarchy: a nullable parentId keeps subtasks simple while preventing hierarchy loops.
- Controlled Task Lifecycle: the task status transition matrix prevents invalid state progression.
- Role-Based Authorization: system roles and project roles govern access across projects, tasks, and RCA actions.
- Atomic Writes and Activity History: task, dependency, and RCA updates are written with ActivityLog records in the same transaction.
- Local File Storage for MVP: uploaded attachments are stored locally in uploads/ rather than depending on cloud storage.
- No Task Hard Deletion: tasks are not physically deleted so historical records remain intact.

## Future Evolution

The following are possible future directions and are not currently implemented:
- Offline-first sync and local caching on the client.
- Stronger compliance and retention workflows.
- Higher-scale event transport, sharding, or caching.
- Containerized or multi-region deployment.
