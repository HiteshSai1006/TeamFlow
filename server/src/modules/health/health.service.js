import prisma from '../../config/db.js';

/**
 * Checks database connectivity by executing a simple SELECT 1 query
 * @returns {Promise<{status: string, error: string|null, durationMs: number}>}
 */
export const checkDatabaseHealth = async () => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const durationMs = Date.now() - start;
    return {
      status: 'UP',
      error: null,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    return {
      status: 'DOWN',
      error: error.message,
      durationMs,
    };
  }
};
