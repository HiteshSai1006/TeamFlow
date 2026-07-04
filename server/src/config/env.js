import dotenv from 'dotenv';

// Load environmental configuration
dotenv.config();

const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Validate critical variables
if (!env.DATABASE_URL) {
  console.error('CRITICAL ERROR: DATABASE_URL is not defined in the environment.');
  process.exit(1);
}

export default env;
