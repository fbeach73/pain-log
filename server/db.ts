import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Check for DATABASE_URL - more graceful handling to prevent application crash
if (!process.env.DATABASE_URL) {
  console.error("====================================================================");
  console.error("WARNING: DATABASE_URL environment variable is not set!");
  console.error("Data persistence will NOT work! All data will be lost on restart!");
  console.error("Please add the DATABASE_URL environment variable to enable persistence.");
  console.error("====================================================================");
  
  // We'll handle this in the storage.ts file by falling back to memory storage
  // rather than throwing an error and crashing the application
  
  // Export dummy objects that will be replaced in storage.ts
  export const pool = null;
  export const db = null;
} else {
  // Configure PostgreSQL with better options for production
  try {
    export const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Add additional options to improve connection reliability
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false  // Accept self-signed certificates in production
      } : undefined,
      max: 5,                      // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,    // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection couldn't be established
    });
    export const db = drizzle(pool, { schema });
    console.log("PostgreSQL connection initialized successfully");
  } catch (error) {
    console.error("Failed to initialize PostgreSQL connection:", error);
    // Export dummy objects that will be replaced in storage.ts
    export const pool = null;
    export const db = null;
  }
}
