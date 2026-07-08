# TeamFlow

TeamFlow is a full-stack project management application for planning work, tracking tasks, and documenting structured post-incident reviews. The project uses a React frontend, an Express backend, Prisma with PostgreSQL, and a modular monolith architecture.

## Project Overview
TeamFlow allows teams to:
- create and manage projects
- assign tasks and track status transitions
- add comments, attachments, and task dependencies
- manage task hierarchy and project-level permissions
- run RCA workflows with review rounds and reporting

## Setup Instructions
1. Clone the repository and open the project folder.
2. Start the local PostgreSQL database:
   ```bash
   docker compose up -d
   ```
3. Install dependencies for the server and client:
   ```bash
   cd server
   npm install
   cd ../client
   npm install
   ```
4. Configure environment variables for the server (see below).
5. Apply the Prisma schema to the database:
   ```bash
   cd ../server
   npx prisma migrate deploy
   ```
6. Start the backend and frontend:
   ```bash
   npm run dev
   ```
   In a second terminal:
   ```bash
   cd ../client
   npm run dev
   ```

## Environment Variables
Create a `.env` file in the server directory with the following values:

```env
DATABASE_URL=postgresql://teamflow_user:teamflow_password@localhost:5435/teamflow_db?schema=public
JWT_SECRET=replace_with_a_long_random_string
PORT=5000
NODE_ENV=development
```

## Assumptions Made
- Docker is available locally for running PostgreSQL.
- The application is intended for local development and evaluation rather than production deployment.
- Authentication uses browser cookies and JWTs issued by the backend.
- File uploads are stored on the local server filesystem.

## Features Implemented
- JWT-based authentication and protected routes
- Project membership and role-based access control
- Task creation, updates, comments, attachments, hierarchy, and dependencies
- RCA workflow with review rounds and structured sections
- Notifications and user preferences
- Task export to CSV and reporting views

## Known Limitations
- Email delivery is simulated rather than sent through a real mail provider.
- Attachments are stored locally in the server upload directory.
- File uploads are limited to one file per request and a small size cap.
- The current implementation is best suited for a modular monolith and not a distributed microservice architecture.
