import app from './app.js';
import env from './config/env.js';
import prisma from './config/db.js';

const startServer = async () => {
  // Test connection to the database
  try {
    console.log('[Server] Checking database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Server] Database connection verified successfully.');
  } catch (error) {
    console.error('[Server] CRITICAL: Could not connect to database on startup.');
    console.error(error.message);
    // Do not crash the server immediately, allowing the health endpoint to report DEGRADED status
  }

  const server = app.listen(env.PORT, () => {
    console.log(`[Server] TeamFlow API running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Handle graceful shutdowns
  const handleShutdown = async (signal) => {
    console.log(`[Server] Received ${signal}. Initializing graceful shutdown...`);
    
    server.close(async () => {
      console.log('[Server] HTTP server stopped.');
      try {
        await prisma.$disconnect();
        console.log('[Server] Database connection closed.');
      } catch (dbErr) {
        console.error('[Server] Error disconnecting from database:', dbErr.message);
      }
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      console.error('[Server] Graceful shutdown timed out, force terminating.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
};

startServer();
