# TeamFlow Monorepo Foundation

GitHub Repository: [https://github.com/HiteshSai1006/TeamFlow](https://github.com/HiteshSai1006/TeamFlow)

## Project Overview

TeamFlow is a modular monolith application designed to streamline project operations for software engineering teams. It provides a secure environment for multi-project coordination, task management, and structured post-mortem incident investigation via Root Cause Analysis.

---

## Architecture Stack

* **Frontend**: React + Vite (Vanilla CSS, JavaScript ESM)
* **Backend**: Node.js + Express (JavaScript ESM, HttpOnly JWT cookies)
* **Database**: PostgreSQL 15 (Dockerized)
* **ORM**: Prisma ORM

---

## Architecture Summary

* **Modular Monolith**: Code is partitioned cleanly by functional domains on the client (`client/src/features/`) and the server (`server/src/modules/`), ensuring domain boundaries are maintained.
* **Transactional Event Outbox**: Notifications and worker processes are decoupled from request-response lifecycles. Business actions write events to a central outbox table inside a transaction scope, and a background worker claims notifications using SQL CTEs with `SKIP LOCKED` to safely allow concurrent worker nodes.
* **Cycle Prevention**: Task dependency paths and subtask parenting loops are validated using graph traversal (BFS and loop checks) inside database transactions to block invalid relationships.

---

## Project Structure

```text
.
├── client/                 # React + Vite frontend application
│   ├── src/
│   │   ├── features/       # Feature-based source modules
│   │   └── main.jsx
│   └── package.json
├── server/                 # Express backend application
│   ├── prisma/             # Prisma schema & migration files
│   ├── src/
│   │   ├── config/         # App & Environment configuration
│   │   ├── middleware/     # Custom Express middlewares
│   │   ├── modules/        # Modular monolith feature components
│   │   ├── app.js          # Express app definition
│   │   └── server.js       # HTTP server bootloader
│   └── package.json
├── docs/                   # Engineering documentation
│   ├── engineering-journal.md
│   ├── ai-agent-build-process.md
│   ├── decisions/          # Architectural Decision Records (ADRs)
│   └── diagrams/           # System design diagrams
├── docker-compose.yml      # Local Postgres database docker config
└── README.md               # Main instructions
```

---

## Prerequisites

* **Node.js & npm**: Node.js runtime and package manager for dependency resolution.
* **Docker & Docker Compose**: Docker desktop environment for orchestrating local containers.
* **PostgreSQL**: Containerized database engine using image `postgres:15-alpine`.

---

## Environment Variables

The server configuration depends on the following environment variables (defined in `server/.env`):

| Variable Name | Required / Optional | Safe Example Value | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Required** | `postgresql://teamflow_user:teamflow_password@localhost:5435/teamflow_db?schema=public` | PostgreSQL database connection string. |
| `JWT_SECRET` | **Required** | `your_jwt_secret_key_minimum_32_characters_long` | Private signing key for HttpOnly JWT session tokens. |
| `PORT` | *Optional* | `5000` | Port for the backend API server. Defaults to `5000`. |
| `NODE_ENV` | *Optional* | `development` | The execution environment. Defaults to `development`. |

Note: The current frontend source does not consume runtime environment variables. During development, Vite proxies /api requests to the backend. The placeholder VITE_API_URL in client/.env.example is currently unused.

---

## Startup Steps

### 1. Database Setup
Start the local PostgreSQL database using Docker Compose:
```bash
docker compose up -d
```

### 2. Backend Setup
Navigate to the server directory, configure environment variables, install dependencies, run migrations, and start the development server:
```bash
cd server
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev
```

### 3. Frontend Setup
Navigate to the client directory, install dependencies, and start the development server:
```bash
cd client
npm install
npm run dev
```

### 4. Build Frontend for Production
To build the static assets for production:
```bash
cd client
npm run build
```

---

## Verification Test Suites

There is currently no unified test runner. All test suites must be executed individually from the `server/` directory against a running server (port 5000):

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

## Features Implemented

* **User Authentication**: Secure credentials authentication with JWT tokens persisted in HttpOnly cookies.
* **Project Dashboard**: Multi-project tracking and coordination interfaces.
* **Active State Persistence**:
  * The active project context is persisted in local storage (`teamflow:activeProject:<userId>`).
  * The active project tab context is persisted in local storage (`teamflow:activeTab:<userId>:<projectId>`).
  * The task visualization mode (Kanban, Calendar, or List) is database-backed per user and per project.
* **Task Coordination**: Task creation, viewing, updating, assignment, lifecycle management, hierarchy, dependencies, comments, and attachments.
* **Task Hierarchies**: Subtask parenting relationships validated with cycle prevention.
* **Task Dependencies**: Relational dependencies preventing dependency loops.
* **Root Cause Analysis (RCA)**: Post-incident investigation documents structured into four sections (Timeline, Factors, Actions, Measures) with a reviewer approval workflow.
* **Analytics Reports**: Live completion rates, workload tables, weekly velocity trends, and project health indices.
* **CSV Export**: Filter-respecting task list downloads in CSV format.
* **Transactional Notifications**: Event outbox system for delivering in-app notification alerts and mock email logs.

---

## Assumptions Made

* **Project Boundaries**: Task relationships (dependencies and parenting) are strictly scoped within the same project. Cross-project task relations are invalid.
* **State Persistence**:
  * Theme preference: account-backed/server-persisted.
  * Task visualization mode: server-persisted per user/project.
  * Active project context: user-scoped localStorage.
  * Active workspace tab: user/project-scoped localStorage.
* **No RCA general comments/attachments**: RCAs do not support general comments or attachments. Only reviewer approval/rejection decision comments are supported.
* **No Task Deletion**: In order to preserve the database integrity and audit logs, task deletion is intentionally unsupported.

---

## Known Limitations

* **Local File Uploads**: Attachment binaries are written directly to local server directories (`uploads/`) under the mock storage service rather than external object storage.
* **Upload Boundaries**: File uploads are capped at exactly 5 MB per request, and only one file may be uploaded at a time.
* **Mock Email Worker**: Email deliveries are simulated via a mock worker that writes to a local file logger (`/server/uploads/mock_emails.log`) in local development modes and uses a console placeholder in production rather than an SMTP server. Failed deliveries are retried for a maximum of 3 attempts.
* **Workload Warning Scope**: Overload indicators (users with more than 5 active tasks) are visual styling in the Reports Tab and do not raise blocking validation dialogs on task editing.
