# Key Architectural and Design Decisions

## 1. Architectural Decisions

### 1.1 Modular Monolith vs Microservices

**Decision:** TeamFlow uses a **modular monolith architecture**. The system is deployed as a single backend application but is divided into domain-focused modules such as Authentication, Projects, Tasks, RCA and Reviews, Notifications, Reporting, and Activity Logging.

**Alternative considered:** Microservices architecture.

**Trade-offs:** Microservices provide independent deployment and scaling but introduce additional complexity in service communication, deployment, distributed transactions, and monitoring. A monolith is simpler to develop and operate, although individual modules cannot be scaled independently.

**Rationale:** TeamFlow is currently a single product with closely related business workflows. A modular monolith provides clear domain boundaries without unnecessary distributed-system complexity. Modules such as Notifications or Reporting can be extracted into separate services later if scaling requirements justify it.

---

### 1.2 PostgreSQL vs NoSQL

**Decision:** TeamFlow uses **PostgreSQL** as its primary database, accessed through Prisma ORM.

**Alternative considered:** A NoSQL document database such as MongoDB.

**Trade-offs:** NoSQL offers flexible schemas and can suit loosely structured data, while PostgreSQL requires a more explicit schema. However, SQL databases provide stronger support for relationships, foreign keys, constraints, joins, and transactions.

**Rationale:** TeamFlow contains strongly related entities such as Users, Projects, Project Memberships, Tasks, RCAs, Reviews, Notifications, and Activity Logs. These relationships and the need for transactional consistency make a relational database the better choice. Prisma provides a central schema, migration support, and a structured data-access layer.

---

### 1.3 Synchronous vs Event-Driven Communication

**Decision:** Core business operations use **synchronous REST APIs with JSON over HTTP**, while asynchronous processing is reserved for suitable background work such as notification delivery.

**Alternative considered:** A fully event-driven architecture using a message broker.

**Trade-offs:** Synchronous communication is simple and gives immediate responses but can make long-running operations slower. Event-driven communication improves decoupling and background processing but adds infrastructure, eventual consistency, retry handling, and operational complexity.

**Rationale:** Actions such as login, project creation, task updates, and status transitions require immediate confirmation, so synchronous REST communication is appropriate. Non-critical work such as notification delivery can be processed asynchronously without delaying the main business operation. This provides a practical balance without introducing a message broker for every workflow.

---

### 1.4 File Storage Strategy

**Decision:** TeamFlow stores uploaded attachment files on the application server's local filesystem for the current MVP, while attachment metadata such as the original filename, storage key, MIME type, size, uploader, and related task is stored in PostgreSQL.

**Alternatives considered:** Storing binary files directly in PostgreSQL or using cloud object storage such as Amazon S3.

**Trade-offs:** Local storage is simple and avoids external infrastructure, but it is not suitable for horizontally scaled or multi-instance production deployments. Database BLOB storage would increase database size and backup cost, while object storage would provide better durability and scalability but introduce an additional external dependency.

**Rationale:** Local file storage is appropriate for the current MVP and development environment. Separating file binaries from relational metadata keeps PostgreSQL focused on structured application data. A production version could replace local storage with object storage while retaining the same metadata model.

---

## 2. Major Design Decisions

### 2.1 Layered Backend Structure

**Decision:** Backend requests follow the structure:

**Route → Middleware → Domain Service / Business Logic → Prisma → PostgreSQL**

**Alternative considered:** Placing request handling, business rules, and database queries directly inside route handlers.

**Trade-offs:** A layered design introduces more files and structure but improves separation of concerns, testing, maintainability, and consistency.

**Rationale:** TeamFlow contains important workflow and authorization rules. Keeping business logic inside domain services and separate from HTTP routing prevents route handlers from becoming overly complex and makes domain rules easier to maintain.

---

### 2.2 Two-Level Role-Based Access Control

**Decision:** TeamFlow separates global **System Roles** from project-specific **Project Roles** such as MANAGER, MEMBER, and REVIEWER.

**Alternative considered:** A single global role for each user.

**Trade-offs:** Two-level authorization requires additional membership checks but provides much greater flexibility.

**Rationale:** A user may have different responsibilities in different projects. For example, the same user can be a MANAGER in one project and a MEMBER in another. Project membership is therefore modelled as a separate entity that connects Users and Projects and stores the user's role within that project.

---

### 2.3 Explicit Task Lifecycle

**Decision:** Tasks use controlled states such as TODO, IN_PROGRESS, BLOCKED, and DONE, with valid transitions enforced by backend business rules.

**Alternative considered:** Allowing any task status to change directly to any other status.

**Trade-offs:** Explicit transitions reduce flexibility but prevent invalid workflow states and improve consistency.

**Rationale:** TeamFlow is a workflow system, so task state changes must follow predictable lifecycle rules. These rules are enforced by the backend rather than relying only on frontend controls.

---

### 2.4 Self-Referencing Tasks for Subtasks

**Decision:** Subtasks are represented using a self-referencing Task relationship.

**Alternative considered:** Creating a separate Subtask entity.

**Trade-offs:** Self-referencing relationships require careful validation to prevent invalid hierarchies but avoid duplicating task fields and logic.

**Rationale:** A subtask is still a task with the same properties, including status, priority, assignment, and lifecycle behaviour. Reusing the Task model keeps the domain model simpler and more consistent.

---

### 2.5 Project-Scoped Task Dependencies

**Decision:** Task dependencies are represented through a separate TaskRelation entity and are restricted to tasks within the same project.

**Alternative considered:** Storing dependency identifiers directly inside the Task model or allowing cross-project dependency relationships.

**Trade-offs:** A separate relation entity requires additional validation and graph traversal, but it supports multiple dependencies, prevents duplicate relationships, and keeps dependency data normalized.

**Rationale:** Project-scoped dependencies preserve clear ownership, authorization, and workflow boundaries. The backend prevents self-dependencies and dependency cycles so that circular blocking relationships cannot create impossible workflows.

---

### 2.6 Auditability and Data Preservation

**Decision:** Tasks are not hard-deleted, archived projects reject further operational mutations, and important business actions create ActivityLog records.

**Alternatives considered:** Permanently deleting records and allowing archived projects to remain editable.

**Trade-offs:** Preserving historical data requires additional storage and lifecycle rules but improves traceability, reporting, and accountability.

**Rationale:** TeamFlow manages project execution and RCA investigations, where historical records are important. Preserving tasks and activity history ensures that past decisions and workflow changes remain traceable.

---

### 2.7 Atomic Business Operations

**Decision:** Related database changes, such as updating a task and recording its activity log, are performed atomically using database transactions.

**Alternative considered:** Executing each database operation independently.

**Trade-offs:** Transactions add some implementation complexity but prevent partial updates.

**Rationale:** TeamFlow must avoid inconsistent states. A business operation should either complete fully or fail fully. For example, a task status should not change without its corresponding activity record being created when that operation requires audit history.

---

### 2.8 Transactional Outbox for Notifications

**Decision:** TeamFlow persists notification events in EventOutbox as part of relevant business operations and processes them asynchronously through background workers.

**Alternative considered:** Sending notifications and email directly inside the original HTTP request.

**Trade-offs:** The outbox approach introduces processing states, background workers, retries, and eventual delivery latency. However, it prevents notification failures from unnecessarily failing the original business operation and provides more reliable event processing.

**Rationale:** Core user actions require immediate responses, while notification delivery is a secondary effect. Persisting events before asynchronous processing creates a durable boundary between the business operation and notification delivery. EventOutbox is used for durable event delivery, while ActivityLog remains the audit and history mechanism.

---

### 2.9 Backend-Enforced Security and Business Rules

**Decision:** Authentication, authorization, lifecycle validation, and business invariants are enforced by the backend.

**Alternative considered:** Relying primarily on frontend controls such as hiding restricted buttons.

**Trade-offs:** Backend validation adds repeated checks but creates a reliable security boundary.

**Rationale:** Frontend restrictions can be bypassed through direct API requests. Therefore, the backend is the authoritative enforcement point for permissions and business rules.

---

## Conclusion

TeamFlow uses a **modular monolith** with a React frontend, Node.js and Express backend, synchronous REST APIs, Prisma ORM, and PostgreSQL. The architecture deliberately avoids unnecessary distributed-system complexity while maintaining clear module boundaries and a path for future growth.

Core design decisions focus on relational consistency, project-scoped workflows, role-based authorization, auditability, atomic transactions, durable notification processing, and backend-enforced business rules. Together, these choices provide a system that is practical for the current scope, maintainable as the product grows, and technically justified against the major alternatives considered.
