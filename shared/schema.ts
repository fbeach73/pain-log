import { pgTable, text, serial, timestamp, integer, boolean, json, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  profileCreated: boolean("profile_created").default(false),
  medicalHistory: json("medical_history").$type<string[]>().default([]),
  painBackground: text("pain_background"),
  // Additional profile fields for better patient information
  age: integer("age"),
  gender: text("gender"),
  height: text("height"),
  weight: text("weight"),
  allergies: json("allergies").$type<string[]>().default([]),
  currentMedications: json("current_medications").$type<string[]>().default([]),
  chronicConditions: json("chronic_conditions").$type<string[]>().default([]),
  activityLevel: text("activity_level"),
  occupation: text("occupation"),
  primaryDoctor: text("primary_doctor"),
  preferredResources: json("preferred_resources").$type<string[]>().default([]),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  firstName: true,
  lastName: true,
  email: true,
});

// Pain entry schema
export const painEntries = pgTable("pain_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  intensity: integer("intensity").notNull(),
  locations: json("locations").$type<string[]>().notNull(),
  characteristics: json("characteristics").$type<string[]>(),
  triggers: json("triggers").$type<string[]>(),
  notes: text("notes"),
  medicationTaken: boolean("medication_taken").default(false),
  medications: json("medications").$type<string[]>(),
});

export const insertPainEntrySchema = createInsertSchema(painEntries).pick({
  userId: true,
  date: true,
  intensity: true,
  locations: true,
  characteristics: true,
  triggers: true,
  notes: true,
  medicationTaken: true,
  medications: true,
});

// Medication schema
export const medications = pgTable("medications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  dosage: text("dosage"),
  frequency: text("frequency"),
  timeOfDay: json("time_of_day").$type<string[]>(),
  active: boolean("active").default(true),
});

export const insertMedicationSchema = createInsertSchema(medications).pick({
  userId: true,
  name: true,
  dosage: true,
  frequency: true,
  timeOfDay: true,
  active: true,
});

// Reminder settings schema
export const reminderSettings = pgTable("reminder_settings", {
  userId: integer("user_id").notNull().primaryKey(),
  emailNotifications: boolean("email_notifications").default(true),
  painLogReminders: boolean("pain_log_reminders").default(true),
  medicationReminders: boolean("medication_reminders").default(true),
  wellnessReminders: boolean("wellness_reminders").default(true),
  weeklySummary: boolean("weekly_summary").default(true),
  reminderFrequency: text("reminder_frequency").default("daily"),
  preferredTime: text("preferred_time").default("evening"),
  notificationStyle: text("notification_style").default("gentle"),
  lastUpdated: timestamp("last_updated").defaultNow()
});

export const insertReminderSettingsSchema = createInsertSchema(reminderSettings).pick({
  userId: true,
  emailNotifications: true,
  painLogReminders: true,
  medicationReminders: true,
  wellnessReminders: true,
  weeklySummary: true,
  reminderFrequency: true,
  preferredTime: true,
  notificationStyle: true
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PainEntry = typeof painEntries.$inferSelect;
export type InsertPainEntry = z.infer<typeof insertPainEntrySchema>;
export type Medication = typeof medications.$inferSelect;
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type ReminderSetting = typeof reminderSettings.$inferSelect;
export type InsertReminderSetting = z.infer<typeof insertReminderSettingsSchema>;
