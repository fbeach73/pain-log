import { execSync } from 'child_process';
import fs from 'fs';

// Create a SQL file to directly execute migrations
const sql = `
-- Create reminder_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS reminder_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  email_notifications BOOLEAN DEFAULT TRUE,
  pain_log_reminders BOOLEAN DEFAULT TRUE,
  medication_reminders BOOLEAN DEFAULT TRUE,
  wellness_reminders BOOLEAN DEFAULT TRUE,
  weekly_summary BOOLEAN DEFAULT TRUE,
  reminder_frequency TEXT DEFAULT 'daily',
  preferred_time TEXT DEFAULT 'evening',
  notification_style TEXT DEFAULT 'gentle',
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Create medications table if it doesn't exist (safety check)
CREATE TABLE IF NOT EXISTS medications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  time_of_day JSON,
  active BOOLEAN DEFAULT TRUE
);
`;

fs.writeFileSync('migration.sql', sql);
console.log('Created migration SQL file');

// Run the SQL file to directly execute migrations
try {
  console.log('Running migration...');
  execSync('psql $DATABASE_URL -f migration.sql', { stdio: 'inherit' });
  console.log('Migration completed successfully');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}