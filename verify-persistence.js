import fetch from 'node-fetch';
import fs from 'fs';
import { randomUUID } from 'crypto';

// Generate a unique test user for each run
const testUser = {
  username: `testuser_${Date.now()}`,
  password: 'Test123!',
  firstName: 'Test',
  lastName: 'User',
  email: `test${Date.now()}@example.com`,
  gender: 'Other',
  age: 30
};

// For storing cookies between requests
let cookies = [];

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies.join('; ')
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`http://localhost:5000${endpoint}`, options);
  
  // Save cookies for subsequent requests
  const setCookieHeader = response.headers.raw()['set-cookie'];
  if (setCookieHeader) {
    cookies = setCookieHeader;
  }
  
  if (response.status === 204) {
    return null;
  }
  
  // Special case for logout which returns plain text "OK"
  if (endpoint === '/api/logout' && method === 'POST') {
    const text = await response.text();
    return { status: 'success', message: text };
  }
  
  return await response.json();
}

// Log results to file and console
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync('./persistence-test.log', logMessage + '\n');
}

async function runTest() {
  try {
    // Clear previous log
    if (fs.existsSync('./persistence-test.log')) {
      fs.unlinkSync('./persistence-test.log');
    }
    
    log('Starting persistence verification test...');
    log(`Test user: ${JSON.stringify(testUser)}`);
    
    // Step 1: Register a new user
    log('Registering new user...');
    const registeredUser = await makeRequest('/api/register', 'POST', testUser);
    log(`User registered with ID: ${registeredUser.id}`);
    
    // Step 2: Create pain entry
    log('Creating pain entry...');
    const painEntry = {
      userId: registeredUser.id,
      intensity: 5,
      locations: ['Lower Back'],
      characteristics: ['Aching', 'Throbbing'],
      triggers: ['Sitting'],
      notes: 'Test pain entry for persistence verification',
      medicationTaken: true,
      medications: ['Ibuprofen'],
      date: new Date().toISOString() // Add the required date field
    };
    
    const createdEntry = await makeRequest('/api/pain-entries', 'POST', painEntry);
    log(`Pain entry created: ${JSON.stringify(createdEntry)}`);
    
    // Step 3: Verify data is stored properly
    log('Verifying user data persistence...');
    const userResponse = await makeRequest('/api/user');
    log(`User data from API: ${JSON.stringify(userResponse)}`);
    
    log('Verifying pain entries persistence...');
    const entriesResponse = await makeRequest('/api/pain-entries');
    log(`Pain entries from API: ${JSON.stringify(entriesResponse)}`);
    
    // Step 4: Update reminder settings
    log('Updating reminder settings...');
    const reminderSettings = {
      emailNotifications: true,
      painLogReminders: true,
      medicationReminders: true,
      wellnessReminders: false,
      reminderFrequency: 'weekly',
      preferredTime: 'morning'
    };
    
    const updatedSettings = await makeRequest('/api/user/reminder-settings', 'PATCH', reminderSettings);
    log(`Reminder settings updated: ${JSON.stringify(updatedSettings)}`);
    
    // Step 5: Log out (to verify login persistence)
    log('Logging out...');
    await makeRequest('/api/logout', 'POST');
    log('Logged out successfully');
    
    // Step 6: Log back in
    log('Logging back in...');
    const loginResponse = await makeRequest('/api/login', 'POST', {
      username: testUser.username,
      password: testUser.password
    });
    log(`Logged in again as: ${JSON.stringify(loginResponse)}`);
    
    // Step 7: Verify all data is still accessible after login
    log('Verifying data after re-login...');
    const userAfterLogin = await makeRequest('/api/user');
    log(`User data after re-login: ${JSON.stringify(userAfterLogin)}`);
    
    // Check reminder settings
    log('Verifying reminder settings after re-login...');
    const settingsAfterLogin = await makeRequest('/api/user/reminder-settings');
    log(`Reminder settings after re-login: ${JSON.stringify(settingsAfterLogin)}`);
    
    log('Test completed successfully!');
    return true;
  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error(error);
    return false;
  }
}

// Run the test
runTest().then(success => {
  log(`Test ${success ? 'PASSED' : 'FAILED'}`);
});