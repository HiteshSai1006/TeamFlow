# TeamFlow System Architecture

```mermaid
flowchart TB
    USER["User"]

    subgraph CLIENT["Client Layer"]
        FRONTEND["React + Vite Frontend<br/>Projects · Tasks · RCA · Reports · Notifications"]
    end

    subgraph APP["Application Layer — Node.js + Express Modular Monolith"]
        ROUTES["Express Routes"]
        MIDDLEWARE["Authentication · Authorization · Project Access"]

        subgraph MODULES["Domain Modules"]
            AUTH["Authentication"]
            PROJECTS["Projects"]
            TASKS["Tasks"]
            RCA["RCA & Reviews"]
            COMMENTS["Comments"]
            ATTACHMENTS["Attachments"]
            REPORTING["Reporting"]
            NOTIFICATIONS["Notifications"]
            PREFERENCES["Preferences"]
        end

        SERVICES["Domain Services / Business Logic<br/>Lifecycle Rules · RBAC · Cycle Prevention · Review Rules"]
    end

    subgraph DATA["Data and Storage Layer"]
        PRISMA["Prisma ORM"]
        POSTGRES[("PostgreSQL 15")]
        LOCAL_FILES[("Local File Storage<br/>server/uploads/")]
    end

    subgraph ASYNC["Asynchronous Notification Processing"]
        OUTBOX[("EventOutbox<br/>PENDING")]
        NOTIFICATION_WORKER["Background Notification Worker"]
        NOTIFICATION_TABLE[("Notification Records")]
        EMAIL_WORKER["Background Email Worker"]
        MOCK_EMAIL["Simulated Email Delivery"]
    end

    USER -->|"User action"| FRONTEND
    FRONTEND -->|"Synchronous REST API<br/>JSON over HTTP"| ROUTES
    ROUTES --> MIDDLEWARE
    MIDDLEWARE --> MODULES
    MODULES --> SERVICES

    SERVICES -->|"Structured data access"| PRISMA
    PRISMA --> POSTGRES

    SERVICES -.->|"Attachment upload"| LOCAL_FILES
    SERVICES -->|"Attachment metadata"| PRISMA

    SERVICES -->|"Transactional business write"| POSTGRES
    POSTGRES -.->|"Durable event persisted"| OUTBOX

    OUTBOX -->|"Claim pending events"| NOTIFICATION_WORKER
    NOTIFICATION_WORKER -->|"Resolve recipients & deduplicate"| NOTIFICATION_TABLE
    NOTIFICATION_TABLE -->|"Claim pending email work"| EMAIL_WORKER
    EMAIL_WORKER -->|"Check email preference"| MOCK_EMAIL

    POSTGRES -->|"JSON response data"| SERVICES
    SERVICES --> ROUTES
    ROUTES -->|"HTTP JSON response"| FRONTEND
    FRONTEND -->|"Updated UI"| USER
```

## Architecture Summary

TeamFlow uses a modular monolith architecture with a React and Vite frontend, a Node.js and Express backend, Prisma ORM, and PostgreSQL 15.

Core user operations follow a synchronous request path:

User → React Frontend → Express Route → Middleware → Domain Service / Business Logic → Prisma → PostgreSQL → JSON Response

The backend is divided into domain-focused modules while remaining a single deployable application. Authentication, authorization, task lifecycle rules, project-scoped dependency validation, hierarchy validation, and RCA review rules are enforced by the backend.

Attachment files are stored on the application server's local filesystem under server/uploads/, while attachment metadata is stored in PostgreSQL.

Notification delivery is processed asynchronously. Relevant business operations persist durable events in EventOutbox, and background workers later resolve recipients, create notification records, apply email preferences, and perform simulated email delivery.

ActivityLog is the audit and history mechanism. EventOutbox is a durable event-delivery mechanism and is not used as an audit log.
