import { checkDatabaseHealth } from './health.service.js';

/**
 * Health check handler returning status details for the API and Database
 */
export const getHealth = async (req, res, next) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    const isHealthy = dbHealth.status === 'UP';
    
    const healthStatus = {
      status: isHealthy ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        api: {
          status: 'UP',
          uptime: process.uptime(),
          version: '1.0.0',
        },
        database: {
          status: dbHealth.status,
          durationMs: dbHealth.durationMs,
          error: dbHealth.error,
        },
      },
    };

    // Return 503 Service Unavailable if database is degraded, but still serve the health payload
    const httpStatus = isHealthy ? 200 : 503;
    
    return res.status(httpStatus).json(healthStatus);
  } catch (error) {
    next(error);
  }
};
