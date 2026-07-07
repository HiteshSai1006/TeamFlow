# TeamFlow

TeamFlow is a full-stack web application developed as a modular monolith for collaborative project planning, task coordination, and structured post-incident review. The system is designed to support software teams in managing work, tracking dependencies, and documenting root-cause analysis in a single, coherent platform.

## Project Summary
This repository presents a complete implementation of the TeamFlow system, including:
- A React-based client application
- An Express.js backend with domain-driven modules
- A Prisma-managed PostgreSQL database
- Migration files and schema definitions
- Architectural documentation and implementation notes
- Setup guidance for local execution and evaluation

## Project Overview
TeamFlow enables teams to create and manage projects, coordinate tasks, attach supporting files, maintain task hierarchies and dependencies, and record structured RCA workflows for review and approval. The application demonstrates practical use of modern web-development patterns, database modeling, authentication, and asynchronous notification handling within a unified architecture.

---

## System Architecture

TeamFlow is structured as a **modular monolith**. The system distinguishes between synchronous client request processing and asynchronous, outbox-driven background event execution.

### Request Processing & Event Flow

```mermaid
flowchart TB
    %% Synchronous Request Path
    subgraph SYNC_FLOW ["Synchronous HTTP Request Path"]
        USER["👤 User"]
        FRONTEND["React + Vite Frontend\n(Kanban, Calendar, List Views)"]
        API_GW["Express API Router"]
        AUTH_MW["Authentication & RBAC Middleware"]

        subgraph DOMAIN_MODULES ["Node.js + Express Domain Modules"]
            AUTH["Authentication"]
            PROJ["Projects"]
            TASKS["Tasks"]
            COMMENTS["Comments"]
            ATTACH["Attachments"]
            RCA["RCA (Root-Cause Analysis)"]
            REVIEWS["Reviews"]
            REPORTS["Reports"]
            NOTIF["Notifications"]
            PREFS["Preferences"]
        end

        subgraph RULES ["Business Rules & Validation"]
            VAL_RBAC["RBAC & Membership Verification"]
            VAL_STATE["Task Status Transitions Matrix"]
            VAL_CYCLE["Dependency Cycle Detection (BFS)"]
            VAL_RCA["RCA Multi-Round Review Constraints"]
        end

        subgraph DATA_LAYER ["Data Layer"]
            PRISMA["Prisma ORM"]
            DB[("PostgreSQL 15")]
            FILES[("Local File Storage\n(uploads/)")]
        end

        USER -->|"User Interaction"| FRONTEND
        FRONTEND -->|"HTTP / REST API"| API_GW
        API_GW --> AUTH_MW
        AUTH_MW --> DOMAIN_MODULES
        DOMAIN_MODULES --> RULES
        RULES --> PRISMA
        PRISMA --> DB
        DOMAIN_MODULES -.->|"File Uploads"| FILES
    end

    %% Asynchronous Pipeline
    subgraph ASYNC_PIPELINE ["Asynchronous Notification Pipeline"]
        OUTBOX_TABLE[("EventOutbox Table\n(State: PENDING)")]
        WORKER["Background Notification Worker\n(SKIP LOCKED Processing)"]
        NOTIF_TABLE[("Notification Table\n(Deduplication Enforced)")]
        EMAIL_WORKER["Background Email Worker\n(SKIP LOCKED Processing)"]
        MOCK_EMAIL["Simulated Email Dispatch\n(mock_emails.log / console)"]

        DB -.->|"Transaction Write"| OUTBOX_TABLE
        OUTBOX_TABLE -->|"Claim Events"| WORKER
        WORKER -->|"Fan-Out Notifications"| NOTIF_TABLE
        NOTIF_TABLE -->|"Claim Notifications"| EMAIL_WORKER
        EMAIL_WORKER -->|"Check User Preference"| MOCK_EMAIL
    end
```

---

## Domain Model and Data Design
The persistent data model is defined in the [server/prisma/schema.prisma](server/prisma/schema.prisma) file, with database schema evolution captured through the migration history in `server/prisma/migrations/`.

### Entity Relationship Diagram (ERD)

The ERD below represents TeamFlow's actual PostgreSQL data model, tracking key fields, relationships, and constraints:

```mermaid
erDiagram
    User {
        int id PK
        string name
        string email UK
        string passwordHash
        SystemRole systemRole
        datetime createdAt
        datetime updatedAt
    }

    Project {
        int id PK
        string name
        string description
        ProjectStatus status
        int createdById FK
        datetime createdAt
        datetime updatedAt
    }

    ProjectMember {
        int id PK
        int projectId FK
        int userId FK
        ProjectRole role
        datetime joinedAt
    }

    Task {
        int id PK
        int projectId FK
        int assigneeId FK
        int createdById FK
        int parentId FK
        string title
        string description
        TaskStatus status
        TaskPriority priority
        datetime dueDate
        datetime createdAt
        datetime updatedAt
    }

    TaskRelation {
        int id PK
        int sourceTaskId FK
        int targetTaskId FK
        RelationType type
    }

    ActivityLog {
        int id PK
        int projectId FK
        int taskId FK
        int actorId FK
        ActivityEventType eventType
        json metadata
        datetime createdAt
    }

    Comment {
        int id PK
        int taskId FK
        int authorId FK
        string content
        datetime editedAt
        datetime createdAt
        datetime updatedAt
    }

    CommentMention {
        int id PK
        int commentId FK
        int userId FK
        datetime createdAt
    }

    Attachment {
        int id PK
        int taskId FK
        int uploadedById FK
        string originalName
        string storageKey UK
        string mimeType
        int size
        datetime createdAt
    }

    RCA {
        int id PK
        int projectId FK
        int createdById FK
        string title
        string description
        RCASeverity severity
        RCAStatus status
        int reviewRound
        datetime createdAt
        datetime updatedAt
    }

    RCASection {
        int id PK
        int rcaId FK
        RCASectionType type
        string content
        datetime createdAt
        datetime updatedAt
    }

    Review {
        int id PK
        int rcaId FK
        int reviewerId FK
        int round
        ReviewDecision decision
        string comment
        datetime decidedAt
        datetime createdAt
    }

    EventOutbox {
        int id PK
        int actorId FK
        NotificationEventType eventType
        int entityId
        json metadata
        OutboxProcessingState processingState
        int processingAttempts
        string processingError
        datetime claimedAt
        datetime processedAt
        datetime createdAt
    }

    Notification {
        int id PK
        int recipientId FK
        int eventId FK
        string dedupKey
        string title
        string message
        boolean read
        EmailDeliveryState emailState
        int emailAttempts
        string emailError
        datetime claimedAt
        datetime createdAt
    }

    UserPreference {
        int id PK
        int userId UK
        ThemeMode theme
        boolean emailOptOut
        datetime createdAt
        datetime updatedAt
    }

    ProjectViewPreference {
        int id PK
        int userId FK
        int projectId FK
        TaskViewMode viewMode
        datetime createdAt
        datetime updatedAt
    }

    User ||--o{ Project : "creates (createdById)"
    User ||--o{ ProjectMember : "joins (userId)"
    Project ||--o{ ProjectMember : "contains (projectId)"
    ProjectMember }|--|| Project : "member of"
    ProjectMember }|--|| User : "linked user"

    Project ||--o{ Task : "holds"
    User ||--o{ Task : "creates (createdById)"
    User ||--o{ Task : "assigned (assigneeId)"
    Task o|--o{ Task : "self-reference (parentId / subtasks)"

    Task ||--o{ TaskRelation : "source of dependency (sourceTaskId)"
    Task ||--o{ TaskRelation : "target of dependency (targetTaskId)"

    Project ||--o{ ActivityLog : "tracks"
    Task ||--o{ ActivityLog : "logs"
    User ||--o{ ActivityLog : "triggers (actorId)"

    Task ||--o{ Comment : "contains"
    User ||--o{ Comment : "writes (authorId)"
    Comment ||--o{ CommentMention : "mentions"
    User ||--o{ CommentMention : "tagged (userId)"

    Task ||--o{ Attachment : "holds"
    User ||--o{ Attachment : "uploads (uploadedById)"

    Project ||--o{ RCA : "contains"
    User ||--o{ RCA : "creates (createdById)"
    RCA ||--o{ RCASection : "contains"
    RCA ||--o{ Review : "receives"
    User ||--o{ Review : "judges (reviewerId)"

    User ||--o{ EventOutbox : "acts (actorId)"
    EventOutbox ||--o{ Notification : "fanned out to"
    User ||--o{ Notification : "receives (recipientId)"

    User ||--o| UserPreference : "has"
    User ||--o{ ProjectViewPreference : "sets"
    Project ||--o{ ProjectViewPreference : "stores"
```

*HealthCheck is an infrastructure-support model and is intentionally excluded from the core domain ERD.*

---

## Service Interaction Flow

The interaction sequence details how user requests are parsed and validated synchronously, and how outbox messages are decoupled into the asynchronous background worker loop.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User
    participant UI as React Component
    participant API as Express API Router
    participant MW as Authentication / RBAC Middleware
    participant Service as Domain Service
    participant DB as PostgreSQL 15 (via Prisma)
    participant Worker as Background Notification Worker
    participant EmailWorker as Background Email Worker

    %% Synchronous Request
    User->>UI: Trigger Action (e.g., Change Task Status)
    UI->>API: HTTP Request (JWT Cookie)
    API->>MW: Run Authentication & Project Access Validation
    MW->>API: Context Validated (User Role Approved)
    API->>Service: Execute Request Logic (updateTaskStatus)
    Service->>Service: Validate Business Rules (Task Status Transition Matrix)

    rect rgb(240, 248, 255)
        note right of Service: Prisma Transaction Block
        Service->>DB: Update Task status
        Service->>DB: Persist ActivityLog row
        Service->>DB: Persist EventOutbox row (State: PENDING)
        DB-->>Service: Transaction Confirmed
    end

    Service-->>API: Task Updated Output
    API-->>UI: HTTP JSON Response (Success)
    UI-->>User: React State Update (UI Refreshed)

    %% Asynchronous Processing Loop
    rect rgb(255, 240, 245)
        note over Worker, DB: Background Event Processing Loop (Every 3s)
        Worker->>DB: Query PENDING events (SELECT FOR UPDATE SKIP LOCKED)
        DB-->>Worker: Staged Event rows (State -> PROCESSING)
        Worker->>Worker: Resolve Recipients & Generate dedupKey
        Worker->>DB: Persist unique Notifications & mark outbox PROCESSED
        DB-->>Worker: Write complete
    end

    rect rgb(245, 255, 250)
        note over EmailWorker, DB: Background Email Dispatch Loop (Every 3s)
        EmailWorker->>DB: Query PENDING notifications (SELECT FOR UPDATE SKIP LOCKED)
        DB-->>EmailWorker: Staged Notification rows
        EmailWorker->>DB: Check UserPreferences for emailOptOut
        DB-->>EmailWorker: Preference settings
        alt User opted out
            EmailWorker->>DB: Set EmailState to SKIPPED_OPT_OUT
        else User opted in
            EmailWorker->>EmailWorker: Dispatch to simulated email transport
            alt Dispatch success
                EmailWorker->>DB: Set EmailState to SENT
            else Dispatch fail
                EmailWorker->>DB: Increment emailAttempts (Retry up to 3 times)
            end
        end
    end
```

---

## Architectural and Design Decisions
The implementation reflects a number of deliberate design choices:
- A **modular monolith** architecture was selected to balance maintainability, clarity, and deployment simplicity.
- PostgreSQL and the generated Prisma Client with schema-driven database access are used to provide reliable relational data handling.
- An event-outbox pattern was adopted to support dependable notification processing.
- Task hierarchy and dependency rules are project-scoped and validated at the service layer, backed by database constraints.
- Local file storage is used for attachment handling in the development environment, with metadata persisted in the database.

Further discussion of these decisions is available in the [Architecture and Design Document](docs/architecture-and-design.md).

---

## Features Implemented
- Secure authentication with JWT-based session cookies
- Project creation, membership management, and role-based access control
- Task creation, assignment, status tracking, comments, attachments, parent-child hierarchy, and dependency relationships
- Structured RCA workflow with multi-round review and approval logic
- Reporting and analytics views
- CSV-based task export
- User preference management for theme and task-view settings

---

## Technology Stack
- Frontend: React with Vite (Vanilla CSS)
- Backend: Node.js >= 16 with Express
- Database: PostgreSQL 15 (Dockerized)
- ORM: Prisma 5.x (`@prisma/client`)
- Authentication: JWT with HttpOnly cookies
- Infrastructure: Docker Compose for local database orchestration

---

## Getting Started
1. Clone the repository
   ```bash
   git clone https://github.com/HiteshSai1006/TeamFlow.git
   cd TeamFlow
   ```
2. Start the PostgreSQL database
   ```bash
   docker compose up -d
   ```
3. Configure and start the backend
   ```bash
   cd server
   cp .env.example .env
   npm install
   npx prisma migrate deploy
   npm run dev
   ```
4. Start the frontend
   ```bash
   cd ../client
   npm install
   npm run dev
   ```

---

## Environment Variables
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://teamflow_user:teamflow_password@localhost:5435/teamflow_db?schema=public` | PostgreSQL connection string |
| `JWT_SECRET` | Yes | `your_secure_secret_here` | Secret used to sign JWTs |
| `PORT` | Optional | `5000` | Port for the Express API |
| `NODE_ENV` | Optional | `development` | Runtime environment |

---

## Project Structure
```text
.
├── client/                     # React + Vite frontend
│   └── src/
│       └── features/          # Feature-based UI modules
├── server/                     # Express backend
│   ├── prisma/                 # Prisma schema & migrations
│   ├── src/
│   │   ├── config/            # App & environment config
│   │   ├── middleware/        # Express middlewares (auth, error handling, etc.)
│   │   ├── modules/           # Domain modules (auth, project, task, rca, ...)
│   │   ├── services/          # Business-logic services
│   │   └── utils/             # Helper utilities
│   ├── uploads/                # Local attachment storage & mock email logs
│   ├── .env.example            # Template environment variables
│   └── package.json
└── docs/                       # Engineering documentation
    ├── architecture-and-design.md # System architecture and decisions document
    └── diagrams/               # Architecture diagrams and flowcharts folder
```

- **Docker & Docker Compose**: Docker desktop environment for orchestrating local containers.
- **PostgreSQL**: Containerized database engine using image `postgres:15-alpine`.

---

## Database Schema and Migrations
The application schema is defined in [server/prisma/schema.prisma](server/prisma/schema.prisma), and the migration history is maintained in the `server/prisma/migrations/` directory.

Currently, there are **13 database migrations** applied chronologically to establish the schema:
1. `20260705000000_init_auth`
2. `20260705010000_init_projects`
3. `20260705020000_align_project_domain`
4. `20260705030000_add_task_management`
5. `20260705040000_add_task_relations`
6. `20260705050000_add_task_comments`
7. `20260705060000_add_task_attachments`
8. `20260705070000_add_rca_workflow`
9. `20260705080000_add_notifications`
10. `20260706093000_add_project_view_preferences`
11. `20260706100000_rename_preferences_to_user_preferences`
12. `20260706110000_add_comment_mentions`
13. `20260706120000_add_task_hierarchy`

---

## Assumptions and Design Scope
- Task dependency and hierarchy relationships are constrained to a single project.
- Theme and task-view preferences are stored per user and project context.
- RCA comments and attachments are intentionally limited to review decisions.
- Tasks are not deleted in order to preserve integrity and auditability.

---

## Known Limitations
- Attachments are stored locally in the server uploads directory rather than in cloud object storage.
- File uploads are limited to one file per request and a 5 MB size cap.
- Email delivery is simulated through a mock worker rather than a production SMTP provider.
- Some reporting indicators are visual only and do not block workflow actions.

---

## Verification and Validation
The repository includes verification helpers for migrations, RCA handling, notifications, hierarchy logic, and reporting flows. These can be executed from the server directory as needed:
```bash
cd server
node verify_migration.js
node verify_theme.js
node verify_supplementary.js
node verify_preferences.js
node verify_export.js
node verify_reports.js
node verify_rca.js
node verify_notifications.js
node verify_mentions.js
node verify_hierarchy.js
```

---

## Documentation
- Architecture and Design Document: [docs/architecture-and-design.md](docs/architecture-and-design.md)
- Diagram Assets: `docs/diagrams/`

---

## Demo Video
A short demonstration video outlining the application workflow and core features will be provided as part of the submission package.
**Demo Video:** _Link will be added before submission._

---

## GitHub Repository
[https://github.com/HiteshSai1006/TeamFlow](https://github.com/HiteshSai1006/TeamFlow)
