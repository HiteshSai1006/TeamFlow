# TeamFlow Monorepo Foundation

TeamFlow is a modular monolith application designed to streamline project operations for software engineering teams. It features multi-project organisation across Kanban, calendar, and list views, task lifecycle management with dependencies and subtask hierarchies, structured Root Cause Analysis with a mandatory review workflow, in-app and email notifications, visual analytics, and data export, within a responsive, theme-customisable interface.

## Architecture Stack
- **Frontend**: React + Vite (Vanilla CSS, JavaScript ESM)
- **Backend**: Node.js + Express (JavaScript ESM, HttpOnly JWT cookies)
- **Database**: PostgreSQL 15 (Dockerized)
- **ORM**: Prisma ORM

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

## Known Deployment Limitations

* **Attachment Binary Storage**: Binary attachment content is written directly to local server directories (`uploads/`) under the mock storage service rather than external object storage (such as AWS S3 or MinIO). This fits local developer testing configurations but requires an external storage adapter for full cloud deployment.
