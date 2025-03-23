-- Add mood columns to pain_entries table
ALTER TABLE pain_entries 
ADD COLUMN IF NOT EXISTS mood text,
ADD COLUMN IF NOT EXISTS mood_rating integer;