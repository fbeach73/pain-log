import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

// Function to check if DATABASE_URL is properly set
export function checkDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    console.error("====================================================================");
    console.error("WARNING: DATABASE_URL environment variable is not set!");
    console.error("Data persistence will NOT work! All data will be lost on restart!");
    console.error("Please add the DATABASE_URL environment variable to enable persistence.");
    console.error("====================================================================");
    return false;
  }
  return true;
}

// Initialize the database connection
const initializeDatabaseConnection = () => {
  // Check if DATABASE_URL environment variable is set
  if (!process.env.DATABASE_URL) {
    return { pool: null, db: null };
  }

  try {
    // Configure PostgreSQL with options for production
    const poolConfig: any = {
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    };
    
    // Add SSL configuration in production
    if (process.env.NODE_ENV === 'production') {
      poolConfig.ssl = {
        rejectUnauthorized: false
      };
    }
    
    const dbPool = new Pool(poolConfig);
    
    // Set up error handling on the pool
    dbPool.on('error', (err: Error) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
    
    const dbInstance = drizzle(dbPool, { schema });
    console.log("PostgreSQL connection initialized successfully");
    
    return { pool: dbPool, db: dbInstance };
  } catch (error) {
    console.error("Failed to initialize PostgreSQL connection:", error);
    return { pool: null, db: null };
  }
};

// Export the pool and db instances
const { pool, db } = initializeDatabaseConnection();
export { pool, db };
