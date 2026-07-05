import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './modules/health/health.router.js';
import authRouter from './modules/auth/auth.routes.js';
import projectRouter from './modules/project/project.routes.js';
import taskRouter from './modules/task/task.routes.js';

const app = express();

// Enable Cross-Origin Resource Sharing with credentials support for frontend
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Parse HttpOnly cookie tokens
app.use(cookieParser());

// Parse incoming JSON requests
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[Express] Incoming request: ${req.method} ${req.path}`);
  next();
});

// Bind routers
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/projects/:projectId/tasks', taskRouter);

// Centralized Error Handling Middleware (must be registered last)
app.use(errorHandler);

export default app;
