import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './modules/health/health.router.js';
import authRouter from './modules/auth/auth.routes.js';
import projectRouter from './modules/project/project.routes.js';
import taskRouter from './modules/task/task.routes.js';
import commentRouter from './modules/comment/comment.routes.js';
import attachmentRouter from './modules/attachment/attachment.routes.js';
import rcaRouter from './modules/rca/rca.routes.js';
import reviewRouter from './modules/review/review.routes.js';
import notificationRouter from './modules/notification/notification.routes.js';
import reportRouter from './modules/report/report.routes.js';

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
app.use('/api/projects/:projectId/tasks/:taskId/comments', commentRouter);
app.use('/api/projects/:projectId/tasks/:taskId/attachments', attachmentRouter);
app.use('/api/projects/:projectId/rcas', rcaRouter);
app.use('/api/projects/:projectId/reports', reportRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/notifications', notificationRouter);

// Centralized Error Handling Middleware (must be registered last)
app.use(errorHandler);

export default app;
