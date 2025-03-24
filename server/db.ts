import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

// Export for usage in other files
export { Pool };

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
    console.error("===================================================================");
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is not set!");
    console.error("Sessions and data will not be persistent without a database connection!");
    console.error("");
    console.error("Please make sure the DATABASE_URL is set in your environment");
    console.error("You can view environment variables under the 'Secrets' tab");
    console.error("===================================================================");
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
    
    // Test the connection immediately to verify it works
    dbPool.query('SELECT NOW()', (err, result) => {
      if (err) {
        console.error("===================================================================");
        console.error("DATABASE CONNECTION TEST FAILED!");
        console.error("Error connecting to the database:", err.message);
        console.error("");
        console.error("Please check your DATABASE_URL value in environment variables");
        console.error("===================================================================");
      } else {
        console.log("Database connection test successful:", result.rows[0].now);
        console.log("Sessions will be stored in the database for persistence");
      }
    });
    
    // Set up error handling on the pool
    dbPool.on('error', (err: Error) => {
      console.error('===================================================================');
      console.error('PostgreSQL pool error encountered!');
      console.error('This may affect data persistence and session management');
      console.error('Error details:', err.message);
      console.error('===================================================================');
    });
    
    const dbInstance = drizzle(dbPool, { schema });
    console.log("PostgreSQL connection initialized successfully");
    
    return { pool: dbPool, db: dbInstance };
  } catch (error) {
    console.error("===================================================================");
    console.error("FAILED TO INITIALIZE POSTGRESQL CONNECTION!");
    console.error("Error details:", (error as Error).message);
    console.error("");
    console.error("The application will fall back to memory storage, but data persistence");
    console.error("and user sessions will be lost when the application restarts.");
    console.error("===================================================================");
    return { pool: null, db: null };
  }
};

// Export the pool and db instances
const { pool, db } = initializeDatabaseConnection();
export { pool, db };
