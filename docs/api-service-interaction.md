# TeamFlow API and Service Interaction Overview

## Overview

TeamFlow uses a REST-based API architecture within a modular monolith. The React and Vite frontend communicates with the Node.js and Express backend through synchronous HTTP requests and JSON responses.

The backend is divided into domain-focused modules, while persistent relational data is accessed through Prisma ORM and stored in PostgreSQL 15. Suitable secondary work, such as notification and simulated email delivery, is processed asynchronously through database-backed background workers.

---

## Interaction Overview

```mermaid
flowchart TB
    USER["User / Browser"]

    FRONTEND["React + Vite Frontend<br/>Login · Projects · Tasks · RCA · Reports · Notifications"]

    subgraph API["Express API Layer"]
        ROUTES["Express Routes"]
        AUTH["JWT Authentication"]
        ACCESS["Project Membership & Role Authorization"]
        VALIDATION["Request & Business Validation"]
    end

    subgraph DOMAIN["Domain Services / Business Logic"]
        AUTH_SERVICE["Authentication"]
        PROJECT_SERVICE["Projects"]
        TASK_SERVICE["Tasks"]
        RCA_SERVICE["RCA & Reviews"]
        COLLAB_SERVICE["Comments & Attachments"]
        REPORT_SERVICE["Reporting"]
        NOTIFICATION_SERVICE["Notifications"]
        PREFERENCE_SERVICE["Preferences"]
    end

    PRISMA["Prisma ORM"]
    POSTGRES[("PostgreSQL 15")]

    LOCAL_FILES[("Local File Storage<br/>server/uploads/")]

    subgraph ASYNC["Asynchronous Processing"]
        OUTBOX[("EventOutbox")]
        NOTIFICATION_WORKER["Notification Worker"]
        NOTIFICATIONS[("Notification Records")]
        EMAIL_WORKER["Email Worker"]
        EMAIL_DELIVERY["Simulated Email Delivery"]
    end

    USER -->|"User action"| FRONTEND
    FRONTEND -->|"REST API · JSON over HTTP"| ROUTES
    ROUTES --> AUTH
    AUTH --> ACCESS
    ACCESS --> VALIDATION
    VALIDATION --> DOMAIN

    DOMAIN -->|"Data access & transactions"| PRISMA
    PRISMA --> POSTGRES

    DOMAIN -.->|"Attachment file"| LOCAL_FILES
    DOMAIN -->|"Attachment metadata"| PRISMA

    POSTGRES -.->|"Pending durable event"| OUTBOX
    OUTBOX --> NOTIFICATION_WORKER
    NOTIFICATION_WORKER --> NOTIFICATIONS
    NOTIFICATIONS --> EMAIL_WORKER
    EMAIL_WORKER --> EMAIL_DELIVERY

    DOMAIN -->|"JSON result"| ROUTES
    ROUTES -->|"HTTP response"| FRONTEND
    FRONTEND -->|"Updated interface"| USER
```

---

## Synchronous Request Processing

A typical core API request follows this path:

**User Action → React Frontend → Express Route → Middleware → Domain Service / Business Logic → Prisma → PostgreSQL → JSON Response**

```mermaid
sequenceDiagram
    actor User
    participant Frontend as React Frontend
    participant Route as Express Route
    participant Middleware as Auth / RBAC Middleware
    participant Service as Domain Service
    participant Prisma as Prisma ORM
    participant DB as PostgreSQL

    User->>Frontend: Perform action
    Frontend->>Route: HTTP request with JSON
    Route->>Middleware: Authenticate and authorize
    Middleware->>Service: Validated request context
    Service->>Service: Enforce business rules
    Service->>Prisma: Execute data operation
    Prisma->>DB: SQL query / transaction
    DB-->>Prisma: Result
    Prisma-->>Service: Structured data
    Service-->>Route: Operation result
    Route-->>Frontend: JSON response
    Frontend-->>User: Update interface
```

Security and business rules are enforced by the backend rather than relying on frontend controls.

---

## Authentication Interaction

Authentication uses JWT-based access control with an HttpOnly cookie.

```mermaid
sequenceDiagram
    actor User
    participant Frontend as React Frontend
    participant Auth as Auth Route / Service
    participant Prisma as Prisma ORM
    participant DB as PostgreSQL

    User->>Frontend: Submit email and password
    Frontend->>Auth: POST /api/auth/login
    Auth->>Prisma: Find user by email
    Prisma->>DB: Query user
    DB-->>Prisma: User record
    Prisma-->>Auth: User data
    Auth->>Auth: Verify password with bcrypt
    Auth->>Auth: Generate JWT
    Auth-->>Frontend: Set HttpOnly auth cookie
    Frontend-->>User: Authenticated session
```

For protected requests, the authentication middleware verifies the JWT and attaches the authenticated user context before authorization and business-rule checks continue.

---

## Project Interaction

Project operations combine authentication with project-scoped authorization.

```mermaid
flowchart LR
    FRONTEND["Frontend"] --> API["Project API"]
    API --> AUTH["Authenticate User"]
    AUTH --> MEMBERSHIP["ProjectMember Lookup"]
    MEMBERSHIP --> ROLE["Validate Project Role"]
    ROLE --> SERVICE["Project Domain Logic"]
    SERVICE --> PRISMA["Prisma ORM"]
    PRISMA --> DB[("PostgreSQL")]
```

`ProjectMember` determines whether a user is a `MANAGER`, `MEMBER`, or `REVIEWER` within a specific project.

A user can therefore hold different roles in different projects.

---

## Task Interaction

Task operations contain important authorization and workflow checks.

```mermaid
flowchart TB
    REQUEST["Task API Request"]
    AUTH["Authenticate User"]
    MEMBERSHIP["Check Project Membership"]
    ROLE["Check Role Permission"]
    PROJECT["Verify Project is ACTIVE"]
    RULES["Validate Task Rules<br/>Lifecycle · Hierarchy · Dependencies"]
    TX["Prisma Transaction"]
    TASK["Write Task Change"]
    ACTIVITY["Create ActivityLog"]
    OUTBOX["Create EventOutbox Row<br/>when notification side effect is required"]
    RESPONSE["Return JSON Result"]

    REQUEST --> AUTH
    AUTH --> MEMBERSHIP
    MEMBERSHIP --> ROLE
    ROLE --> PROJECT
    PROJECT --> RULES
    RULES --> TX

    TX --> TASK
    TX --> ACTIVITY
    TX -.-> OUTBOX

    TASK --> RESPONSE
    ACTIVITY --> RESPONSE
    OUTBOX -.-> RESPONSE
```

This interaction ensures that:

- unauthorized users cannot perform restricted actions;
- archived projects reject operational task and dependency mutations;
- invalid task lifecycle transitions are rejected;
- parent-child relationships remain project-scoped and acyclic;
- task dependencies remain project-scoped and acyclic;
- required related writes succeed or fail atomically.

---

## RCA and Review Interaction

TeamFlow uses an RCA workflow rather than a separate Incident entity.

```mermaid
flowchart TB
    FRONTEND["React Frontend"]
    API["RCA API"]
    AUTH["Authentication"]
    ACCESS["Project Membership & Role Authorization"]
    SERVICE["RCA Domain Logic"]
    RULES["RCA Lifecycle & Review Rules"]
    PRISMA["Prisma ORM"]
    DB[("PostgreSQL")]

    FRONTEND --> API
    API --> AUTH
    AUTH --> ACCESS
    ACCESS --> SERVICE
    SERVICE --> RULES
    RULES --> PRISMA
    PRISMA --> DB
```

RCA investigations, structured sections, and reviews remain inside the same modular monolith. Internal modules interact through in-process application logic rather than network calls between separate microservices.

---

## Asynchronous Notification Interaction

Notifications are processed separately from the main HTTP response path.

```mermaid
sequenceDiagram
    actor User
    participant Frontend as React Frontend
    participant Service as Domain Service
    participant Prisma as Prisma Transaction
    participant DB as PostgreSQL
    participant Outbox as EventOutbox
    participant Worker as Notification Worker
    participant Notification as Notification Record
    participant EmailWorker as Email Worker
    participant Delivery as Simulated Email Delivery

    User->>Frontend: Perform business action
    Frontend->>Service: API request
    Service->>Prisma: Begin transaction
    Prisma->>DB: Save business change
    Prisma->>DB: Save ActivityLog when required
    Prisma->>DB: Save EventOutbox row when required
    DB-->>Prisma: Commit
    Prisma-->>Service: Success
    Service-->>Frontend: Return JSON response

    Outbox->>Worker: Claim pending event
    Worker->>Worker: Resolve recipients and deduplicate
    Worker->>Notification: Create recipient notification
    Notification->>EmailWorker: Claim pending email work
    EmailWorker->>EmailWorker: Check user email preference
    EmailWorker->>Delivery: Simulate delivery when allowed
```

The main API request does not wait for notification or email delivery. This improves responsiveness and isolates secondary delivery failures from the core business operation.

`ActivityLog` and `EventOutbox` have different responsibilities:

- `ActivityLog` preserves audit and history records.
- `EventOutbox` provides durable asynchronous event delivery.

---

## Attachment Interaction

Task attachments use local file storage in the current MVP.

```mermaid
flowchart LR
    USER["User"] --> FRONTEND["React Frontend"]
    FRONTEND --> API["Attachment API"]
    API --> AUTH["Authentication & Project Access"]
    AUTH --> SERVICE["Attachment Logic"]

    SERVICE -->|"File binary"| FILES[("Local Storage<br/>server/uploads/")]
    SERVICE -->|"Metadata"| PRISMA["Prisma ORM"]
    PRISMA --> DB[("PostgreSQL")]
```

The file binary is stored on the application server's local filesystem, while metadata such as the original filename, storage key, MIME type, size, uploader, and related task is stored in PostgreSQL.

---

## Internal Service Interaction Rule

Because TeamFlow is a modular monolith, internal domain modules do not communicate through network calls.

The preferred interaction is:

**Express Route → Middleware → Domain Service / Business Logic → Required Internal Logic / Prisma**

TeamFlow does not use internal communication such as:

**Task Microservice → HTTP → Notification Microservice → HTTP → Project Microservice**

Keeping domain interactions in-process avoids unnecessary network overhead, distributed transactions, service discovery, and additional deployment complexity.

---

## Interaction Summary

TeamFlow uses synchronous REST APIs for communication between the React frontend and Express backend. Requests pass through authentication, project-scoped authorization, validation, and domain business rules before Prisma accesses PostgreSQL.

Core operations return immediate JSON responses. Related writes are performed atomically where consistency requires it, `ActivityLog` preserves important history, and `EventOutbox` separates durable notification events from the main request path.

Asynchronous background workers process notification and simulated email delivery without requiring internal microservices or a separate message broker. This interaction model supports clear domain boundaries while retaining the operational simplicity of a modular monolith.
