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
The application follows a layered modular-monolith architecture designed for clarity, maintainability, and extensibility.

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
