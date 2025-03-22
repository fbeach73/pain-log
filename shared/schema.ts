import { pgTable, text, serial, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PainEntry = typeof painEntries.$inferSelect;
export type InsertPainEntry = z.infer<typeof insertPainEntrySchema>;
export type Medication = typeof medications.$inferSelect;
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
