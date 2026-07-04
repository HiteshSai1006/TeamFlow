import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './modules/health/health.router.js';

const app = express();

// Enable Cross-Origin Resource Sharing for frontend client
app.use(cors());

// Parse incoming JSON requests
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[Express] Incoming request: ${req.method} ${req.path}`);
  next();
});

// Bind routers
app.use('/api', healthRouter);

// Centralized Error Handling Middleware (must be registered last)
app.use(errorHandler);

export default app;
