# TeamFlow Monorepo Foundation

TeamFlow is a modular monolith application designed to streamline project operations. This repository contains the foundation setup for the project.

## Architecture Stack
- **Frontend**: React + Vite (Vanilla CSS, JavaScript ESM)
- **Backend**: Node.js + Express (JavaScript ESM)
- **Database**: PostgreSQL (Dockerized)
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
│   ├── decisions/          # Architectural Decision Records (ADRs)
│   └── diagrams/           # System design diagrams
├── docker-compose.yml      # Local Postgres database docker config
└── README.md               # Main instructions
```

## Running the Application

### 1. Database Setup
Start the local PostgreSQL database using Docker Compose:
```bash
docker compose up -d
```

### 2. Backend Setup
Navigate to the server directory, install dependencies, run migrations, and start the development server:
```bash
cd server
npm install
npx prisma db push
npm run dev
```

The server runs on [http://localhost:5000](http://localhost:5000). You can verify its health directly via [http://localhost:5000/api/health](http://localhost:5000/api/health).

### 3. Frontend Setup
Navigate to the client directory, install dependencies, and start the development server:
```bash
cd client
npm install
npm run dev
```

The frontend client will be running on [http://localhost:5173](http://localhost:5173). It is configured to automatically proxy API requests to the backend server.
