# TeamFlow

TeamFlow is a full-stack web application developed as a modular monolith for collaborative project planning, task coordination, and structured post-incident review. The system is designed to support software teams in managing work, tracking dependencies, and documenting root-cause analysis in a single, coherent platform.

## Project Summary
This repository presents a complete implementation of the TeamFlow system, including:
- a React-based client application
- an Express.js backend with domain-driven modules
- a Prisma-managed PostgreSQL database
- migration files and schema definitions
- architectural documentation and implementation notes
- setup guidance for local execution and evaluation

## Project Overview
TeamFlow enables teams to create and manage projects, coordinate tasks, attach supporting files, maintain task hierarchies and dependencies, and record structured RCA workflows for review and approval. The application demonstrates practical use of modern web-development patterns, database modeling, authentication, and asynchronous notification handling within a unified architecture.



## System Architecture

TeamFlow follows a **modular monolith architecture**. The React frontend communicates with a Node.js and Express REST API. Business rules are enforced in the backend before Prisma accesses PostgreSQL.

```mermaid
flowchart TB
    USER["👤 User"]

    subgraph FRONTEND["Frontend — React + Vite"]
        UI["Projects · Tasks · RCA · Reports"]
        VIEWS["Kanban · Calendar · List"]
        UX["Notifications · Light/Dark Theme"]
    end

    subgraph BACKEND["Backend — Node.js + Express"]
        API["REST API"]
        MODULES["Auth · Projects · Tasks · Comments"]
        MORE["Attachments · RCA · Reviews · Reports"]
        PREFS["Notifications · Preferences"]
    end

    subgraph RULES["Business Rules"]
        RBAC["Role-Based Access Control"]
        TASK["Task Lifecycle State Machine"]
        DEP["Dependency Cycle Prevention"]
        RCA["RCA & Review Workflow"]
        DEDUP["Notification Deduplication"]
        AUDIT["Activity Logging"]
    end

    subgraph DATA["Data Layer"]
        PRISMA["Prisma ORM"]
        DB[("PostgreSQL")]
        FILES[("Local File Storage")]
    end

    subgraph NOTIFICATIONS["Notification Pipeline"]
        EVENT["Event Triggered"]
        PERSIST["Persist Event"]
        DEDUPE["Suppress Duplicate"]
        DELIVERY["In-App Alert + Email Worker"]

        EVENT --> PERSIST --> DEDUPE --> DELIVERY
    end

    USER --> FRONTEND
    FRONTEND -->|"HTTP / REST API"| BACKEND
    BACKEND --> RULES
    RULES --> PRISMA
    PRISMA --> DB
    BACKEND --> FILES

    BACKEND --> EVENT
```

### Request Flow

```mermaid
flowchart LR
    A["User Action"] --> B["React Component"]
    B --> C["REST API"]
    C --> D["Authentication"]
    D --> E["Project Access Check"]
    E --> F["Business Rule Validation"]
    F --> G["Service Layer"]
    G --> H["Prisma"]
    H --> I[("PostgreSQL")]
    I --> J["API Response"]
    J --> K["UI Updates"]
```

### Secondary Event Flow
```text
BUSINESS ACTION
  |
  v
EVENT OUTBOX
  |
  v
NOTIFICATION WORKER
  |
  +----------------------+
  |                      |
  v                      v
IN-APP NOTIFICATION   MOCK EMAIL DELIVERY
                           |
                           v
                         RETRY
```

This architecture enables the application to separate presentation, API handling, business logic, persistence, and asynchronous notification concerns while remaining deployable as a single cohesive system.

## Domain Model and Data Design
The core domain entities include:
- User
- Project
- ProjectMember
- Task
- TaskRelation
- Comment
- Attachment
- RCA
- RCAReview
- Notification
- UserPreference

The persistent data model is defined in server/prisma/schema.prisma, with schema evolution captured through the migration history in server/prisma/migrations/.

## Entity Relationship Diagram

The ERD below represents TeamFlow's actual PostgreSQL data model. It includes project membership, hierarchical tasks, dependencies, comments and mentions, attachments, RCA investigations and reviews, the transactional notification outbox, and persisted user preferences.

```mermaid
ER-Diagram

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
        string title
        string description
        TaskStatus status
        TaskPriority priority
        int assigneeId FK
        datetime dueDate
        int createdById FK
        int parentId FK
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
        string title
        string description
        RCASeverity severity
        RCAStatus status
        int reviewRound
        int createdById FK
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
        NotificationEventType eventType
        int entityId
        int actorId FK
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
        int userId FK
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

    User ||--o{ Project : creates
    User ||--o{ ProjectMember : joins
    Project ||--o{ ProjectMember : contains

    Project ||--o{ Task : contains
    User ||--o{ Task : creates
    User ||--o{ Task : assigned

    Task o|--o{ Task : parent_of

    Task ||--o{ TaskRelation : source
    Task ||--o{ TaskRelation : target

    Project ||--o{ ActivityLog : records
    Task ||--o{ ActivityLog : generates
    User ||--o{ ActivityLog : performs

    Task ||--o{ Comment : has
    User ||--o{ Comment : writes

    Comment ||--o{ CommentMention : contains
    User ||--o{ CommentMention : mentioned

    Task ||--o{ Attachment : has
    User ||--o{ Attachment : uploads

    Project ||--o{ RCA : contains
    User ||--o{ RCA : creates

    RCA ||--o{ RCASection : contains
    RCA ||--o{ Review : receives
    User ||--o{ Review : performs

    User ||--o{ EventOutbox : triggers
    EventOutbox ||--o{ Notification : produces
    User ||--o{ Notification : receives

    User ||--o| UserPreference : has

    User ||--o{ ProjectViewPreference : owns
    Project ||--o{ ProjectViewPreference : stores
```


## Service Interaction Overview
A typical request in TeamFlow follows this flow:
1. The client sends a request to the Express API.
2. Authentication and project-access middleware validate the request context.
3. A domain service executes the relevant business logic.
4. Prisma persists the resulting state in PostgreSQL.
5. Important actions emit events to the outbox for downstream processing.
6. A background worker processes those events to generate notifications and related artifacts.

## Architectural and Design Decisions
The implementation reflects a number of deliberate design choices:
- A modular monolith architecture was selected to balance maintainability, clarity, and deployment simplicity.
- Prisma ORM and PostgreSQL were used to provide strong schema management and reliable relational data handling.
- An event-outbox pattern was adopted to support dependable notification processing.
- Task hierarchy and dependency rules are enforced at the service layer and database level to preserve data consistency.
- Local file storage is used for attachment handling in the development environment, with metadata persisted in the database.

Further discussion of these decisions is available in docs/architecture-decisions.md and docs/engineering-journal.md.

## Features Implemented
- Secure authentication with JWT-based session cookies
- Project creation, membership, and role-based access management
- Task creation, assignment, status tracking, comments, attachments, parent-child hierarchy, and dependency relationships
- Structured RCA workflow with review and approval logic
- Reporting and analytics views
- CSV-based task export
- User preference management for theme and task-view settings

## Technology Stack
- Frontend: React with Vite
- Backend: Node.js with Express
- Database: PostgreSQL 15
- ORM: Prisma
- Authentication: JWT with HttpOnly cookies
- Infrastructure: Docker Compose for local database orchestration

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

## Environment Variables
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | Yes | postgresql://teamflow_user:teamflow_password@localhost:5435/teamflow_db?schema=public | PostgreSQL connection string |
| JWT_SECRET | Yes | your_secure_secret_here | Secret used to sign JWTs |
| PORT | Optional | 5000 | Port for the Express API |
| NODE_ENV | Optional | development | Runtime environment |

## Database Schema and Migrations
The application schema is defined in server/prisma/schema.prisma, and the migration history is maintained in server/prisma/migrations/.

## Assumptions and Design Scope
- Task dependency and hierarchy relationships are constrained to a single project.
- Theme and task-view preferences are stored per user and project context.
- RCA comments and attachments are intentionally limited to review decisions.
- Tasks are not deleted in order to preserve integrity and auditability.

## Known Limitations
- Attachments are stored locally in the server uploads directory rather than in cloud object storage.
- File uploads are limited to one file per request and a 5 MB size cap.
- Email delivery is simulated through a mock worker rather than a production SMTP provider.
- Some reporting indicators are visual only and do not block workflow actions.

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

## Documentation
- Architecture decisions: docs/architecture-decisions.md
- Engineering journal: docs/engineering-journal.md
- Diagram assets: docs/diagrams/

## Demo Video
A short demonstration video outlining the application workflow and core features will be provided as part of the submission package.

## GitHub Repository
https://github.com/HiteshSai1006/TeamFlow
