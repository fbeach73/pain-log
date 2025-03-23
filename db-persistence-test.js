/**
 * Database Persistence Verification Tool
 * 
 * This script tests whether database data persists across server restarts
 * and application redeployments.
 */

import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';

// Configuration
const TEST_USERNAME = 'persistence_test_user';
const TEST_PASSWORD = 'secure_test_password';
const LOG_FILE = 'database-persistence.log';
const API_BASE_URL = 'http://localhost:5000';

// Setup logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Clear the log file
try {
  fs.writeFileSync(LOG_FILE, '');
} catch (err) {
  console.error('Failed to clear log file:', err);
}

log('Starting database persistence verification');

// Helper to make API requests
async function makeRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed: ${response.status} ${response.statusText} - ${text}`);
    }
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    log(`Request error: ${error.message}`);
    return null;
  }
}

// Direct database connection for verification
async function verifyDirectDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    log('No DATABASE_URL provided, skipping direct database check');
    return false;
  }
  
  try {
    log('Testing direct database connection...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const result = await pool.query('SELECT NOW()');
    log(`Database connection successful: ${result.rows[0].now}`);
    
    // Check if our test user exists in the database
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [TEST_USERNAME]);
    if (userCheck.rows.length > 0) {
      log(`Test user found in database: ${TEST_USERNAME} (ID: ${userCheck.rows[0].id})`);
      return true;
    } else {
      log(`Test user not found in database: ${TEST_USERNAME}`);
      return false;
    }
  } catch (error) {
    log(`Database connection failed: ${error.message}`);
    return false;
  }
}

// Run the verification test
async function runTest() {
  log('=== PERSISTENCE VERIFICATION TEST ===');

  // Step 1: Try to register a test user
  let testUserId = null;
  try {
    log(`Step 1: Registering test user: ${TEST_USERNAME}`);
    
    // Try to register user
    const userData = {
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      firstName: 'Persistence',
      lastName: 'Test',
      email: 'persistence@test.com'
    };
    
    const registerResult = await makeRequest('/api/register', 'POST', userData);
    if (registerResult) {
      testUserId = registerResult.id;
      log(`Registration successful. User ID: ${testUserId}`);
    } else {
      // Try to login instead
      log('Registration failed, trying to login...');
      const loginResult = await makeRequest('/api/login', 'POST', {
        username: TEST_USERNAME,
        password: TEST_PASSWORD
      });
      
      if (loginResult) {
        testUserId = loginResult.id;
        log(`Login successful. User ID: ${testUserId}`);
      } else {
        log('Login failed. Cannot proceed with persistence test.');
        return;
      }
    }
  } catch (error) {
    log(`Step 1 failed: ${error.message}`);
    return;
  }
  
  // Step 2: Create a unique pain entry
  try {
    log('Step 2: Creating test pain entry');
    const timestamp = new Date().toISOString();
    const testNote = `Persistence test entry at ${timestamp}`;
    
    const painEntry = {
      userId: testUserId,
      date: new Date().toISOString(),
      intensity: 3,
      locations: ['Lower Back'],
      characteristics: ['Burning', 'Throbbing'],
      triggers: ['Sitting', 'Stress'],
      notes: testNote,
      medicationTaken: true,
      medications: ['Ibuprofen']
    };
    
    const entryResult = await makeRequest('/api/pain-entries', 'POST', painEntry);
    if (entryResult) {
      log(`Pain entry created successfully. Entry ID: ${entryResult.id}`);
    } else {
      log('Failed to create pain entry.');
    }
  } catch (error) {
    log(`Step 2 failed: ${error.message}`);
  }
  
  // Step 3: Verify with direct database connection
  await verifyDirectDatabaseConnection();
  
  log('Persistence verification test completed. Check the log file for results.');
}

// Run the test
runTest();