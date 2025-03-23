
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
