import { users, type User, type InsertUser, painEntries, type PainEntry, type InsertPainEntry, medications, type Medication, type InsertMedication } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { format } from "date-fns";

// Define types for analytics and stats
type TriggerStat = {
  name: string;
  frequency: number;
};

type MedicationWithStatus = Medication & {
  takenToday: boolean[];
};

type Pattern = {
  id: string;
  title: string;
  description: string;
  confidence: number;
  source: string;
};

type Recommendation = {
  id: string;
  title: string;
  description: string;
  type: "exercise" | "tip";
  resourceLink: string;
};

type Resource = {
  id: string;
  title: string;
  description: string;
  type: "article" | "video" | "exercise" | "guide";
  source: string;
  url: string;
  tags: string[];
};

type Report = {
  id: string;
  generatedOn: string;
  periodStart: string;
  periodEnd: string;
  painEntries: number;
  averagePain: number;
  mostCommonLocation: string;
  mostCommonTrigger: string;
  data: any;
};

const MemoryStore = createMemoryStore(session);

// Define the reminder settings type
type ReminderSettings = {
  userId: number;
  emailNotifications: boolean;
  painLogReminders: boolean;
  medicationReminders: boolean;
  wellnessReminders: boolean;
  weeklySummary: boolean;
  reminderFrequency: string;
  preferredTime: string;
  notificationStyle: string;
};

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User>;
  
  // Pain entries
  createPainEntry(entry: InsertPainEntry): Promise<PainEntry>;
  getPainEntriesByUserId(userId: number): Promise<PainEntry[]>;
  getRecentPainEntries(userId: number, limit: number): Promise<PainEntry[]>;
  getPainTrend(userId: number, days: number): Promise<PainEntry[]>;
  getTriggerStats(userId: number): Promise<TriggerStat[]>;
  getPatterns(userId: number): Promise<Pattern[]>;
  
  // Medications
  createMedication(medication: InsertMedication): Promise<Medication>;
  getMedicationsByUserId(userId: number): Promise<Medication[]>;
  getTodayMedications(userId: number): Promise<MedicationWithStatus[]>;
  takeMedication(medicationId: number, doseIndex: number): Promise<any>;
  
  // Resources & Recommendations
  getRecommendations(userId: number): Promise<Recommendation[]>;
  getResources(): Promise<Resource[]>;
  
  // Reports
  getReportsByUserId(userId: number): Promise<Report[]>;
  
  // Reminder Settings
  getReminderSettings(userId: number): Promise<ReminderSettings | undefined>;
  updateReminderSettings(userId: number, settings: Partial<ReminderSettings>): Promise<ReminderSettings>;
  
  // Session store
  sessionStore: ReturnType<typeof createMemoryStore>;
}

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import ConnectPgSimple from 'connect-pg-simple';

export class PostgresStorage implements IStorage {
  private pool: Pool;
  private db: ReturnType<typeof drizzle>;
  sessionStore: ReturnType<typeof createMemoryStore>;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not found in environment");
    }
    
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(this.pool);
    
    // Use PostgreSQL for session storage
    const pgSession = ConnectPgSimple(session);
    this.sessionStore = new pgSession({
      pool: this.pool,
      tableName: 'user_sessions'
    });
    
    // Log to confirm initialization
    console.log('Storage initialized with PostgreSQL');
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values({
      username: insertUser.username,
      password: insertUser.password,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      email: insertUser.email || null,
      profileCreated: false,
      medicalHistory: [],
      painBackground: null,
      age: null,
      gender: null,
      height: null,
      weight: null,
      allergies: [],
      currentMedications: [],
      chronicConditions: [],
      activityLevel: null,
      occupation: null,
      primaryDoctor: null,
      preferredResources: []
    }).returning();

    const user = result[0];
    
    // Create default medication
    await this.createMedication({
      userId: user.id,
      name: "Ibuprofen",
      dosage: "400mg",
      frequency: "As needed",
      timeOfDay: ["Morning", "Evening"],
    });
    
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { ...user, ...userData, profileCreated: true };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createPainEntry(entry: InsertPainEntry): Promise<PainEntry> {
    const id = this.currentPainEntryId++;
    const painEntry: PainEntry = {
      id,
      userId: entry.userId,
      date: entry.date || new Date(),
      intensity: entry.intensity,
      locations: entry.locations || [],
      characteristics: entry.characteristics || null,
      triggers: entry.triggers || null,
      notes: entry.notes || null,
      medicationTaken: entry.medicationTaken || false,
      medications: entry.medications || null
    };
    this.painEntries.set(id, painEntry);
    return painEntry;
  }

  async getPainEntriesByUserId(userId: number): Promise<PainEntry[]> {
    return Array.from(this.painEntries.values())
      .filter(entry => entry.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getRecentPainEntries(userId: number, limit: number): Promise<PainEntry[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    return entries.slice(0, limit);
  }

  async getPainTrend(userId: number, days: number): Promise<PainEntry[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    const now = new Date();
    const filteredEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      const diffTime = Math.abs(now.getTime() - entryDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= days;
    });
    
    return filteredEntries;
  }

  async getTriggerStats(userId: number): Promise<TriggerStat[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    const triggerCounts = new Map<string, number>();
    
    // Count occurrences of each trigger
    entries.forEach(entry => {
      if (entry.triggers && (entry.triggers as string[]).length > 0) {
        (entry.triggers as string[]).forEach(trigger => {
          triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
        });
      }
    });
    
    // Convert to array and calculate frequencies
    const total = entries.length || 1; // Avoid division by zero
    const triggerStats: TriggerStat[] = Array.from(triggerCounts.entries())
      .map(([name, count]) => ({
        name,
        frequency: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.frequency - a.frequency);
    
    // If no entries yet, return some default triggers
    if (triggerStats.length === 0) {
      return [
        { name: "Poor Sleep", frequency: 75 },
        { name: "Stress", frequency: 60 },
        { name: "Physical Activity", frequency: 45 },
        { name: "Weather Changes", frequency: 30 },
        { name: "Diet", frequency: 15 }
      ];
    }
    
    return triggerStats;
  }

  async getPatterns(userId: number): Promise<Pattern[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    
    // Only generate patterns if there are enough entries
    if (entries.length < 5) {
      return [];
    }
    
    // Analyze entries for patterns
    // This is a simplified version - in a real app, this would be more sophisticated
    const patterns: Pattern[] = [];
    
    // Check for time of day pattern
    const morningEntries = entries.filter(e => {
      const hour = new Date(e.date).getHours();
      return hour >= 5 && hour < 12;
    }).length;
    
    const afternoonEntries = entries.filter(e => {
      const hour = new Date(e.date).getHours();
      return hour >= 12 && hour < 18;
    }).length;
    
    const eveningEntries = entries.filter(e => {
      const hour = new Date(e.date).getHours();
      return hour >= 18 || hour < 5;
    }).length;
    
    const totalEntries = entries.length;
    
    if (morningEntries / totalEntries > 0.5) {
      patterns.push({
        id: "pattern-morning",
        title: "Morning Pain Pattern",
        description: "You frequently experience pain in the morning hours. This could be related to sleep position or morning stiffness.",
        confidence: Math.round((morningEntries / totalEntries) * 100),
        source: "Time-based analysis"
      });
    } else if (eveningEntries / totalEntries > 0.5) {
      patterns.push({
        id: "pattern-evening",
        title: "Evening Pain Pattern",
        description: "Your pain tends to worsen in the evening hours. This could be related to daily fatigue or activity buildup.",
        confidence: Math.round((eveningEntries / totalEntries) * 100),
        source: "Time-based analysis"
      });
    }
    
    // Check for trigger patterns
    const triggerStats = await this.getTriggerStats(userId);
    if (triggerStats.length > 0 && triggerStats[0].frequency > 40) {
      patterns.push({
        id: "pattern-trigger",
        title: `${triggerStats[0].name} Correlation`,
        description: `There appears to be a strong correlation between your pain and ${triggerStats[0].name.toLowerCase()}. Consider tracking this trigger more closely.`,
        confidence: triggerStats[0].frequency,
        source: "Trigger correlation analysis"
      });
    }
    
    return patterns;
  }

  async createMedication(medication: InsertMedication): Promise<Medication> {
    const id = this.currentMedicationId++;
    const newMedication: Medication = {
      id,
      userId: medication.userId,
      name: medication.name,
      dosage: medication.dosage || null,
      frequency: medication.frequency || null,
      timeOfDay: medication.timeOfDay || null,
      active: medication.active !== undefined ? medication.active : true
    };
    this.medications.set(id, newMedication);
    return newMedication;
  }

  async getMedicationsByUserId(userId: number): Promise<Medication[]> {
    return Array.from(this.medications.values())
      .filter(med => med.userId === userId && med.active);
  }

  async getTodayMedications(userId: number): Promise<MedicationWithStatus[]> {
    const meds = await this.getMedicationsByUserId(userId);
    const today = format(new Date(), "yyyy-MM-dd");
    
    return meds.map(med => {
      const timeOfDay = med.timeOfDay as string[];
      const takenToday = timeOfDay.map((_, index) => {
        const key = `${med.id}-${today}-${index}`;
        return this.medicationTaken.get(key) || false;
      });
      
      return {
        ...med,
        takenToday
      };
    });
  }

  async takeMedication(medicationId: number, doseIndex: number): Promise<any> {
    const medication = Array.from(this.medications.values())
      .find(med => med.id === medicationId);
    
    if (!medication) {
      throw new Error("Medication not found");
    }
    
    const today = format(new Date(), "yyyy-MM-dd");
    const key = `${medicationId}-${today}-${doseIndex}`;
    this.medicationTaken.set(key, true);
    
    return { success: true, medicationId, doseIndex };
  }

  async getRecommendations(userId: number): Promise<Recommendation[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    
    // Default recommendations if no entries yet
    if (entries.length === 0) {
      return [
        {
          id: "rec-sleep",
          title: "Sleep Improvement",
          description: "Maintaining a consistent sleep schedule can help reduce pain levels for many conditions.",
          type: "tip",
          resourceLink: "/resources"
        },
        {
          id: "rec-relaxation",
          title: "Relaxation Techniques",
          description: "Stress reduction through meditation or deep breathing can help manage pain.",
          type: "exercise",
          resourceLink: "/resources"
        }
      ];
    }
    
    // Generate personalized recommendations based on user data
    const recommendations: Recommendation[] = [];
    const triggerStats = await this.getTriggerStats(userId);
    
    if (triggerStats.some(t => t.name === "Poor Sleep" && t.frequency > 30)) {
      recommendations.push({
        id: "rec-sleep",
        title: "Sleep Improvement",
        description: "Your logs show a correlation between poor sleep and increased pain. Try maintaining a consistent sleep schedule.",
        type: "tip",
        resourceLink: "/resources"
      });
    }
    
    if (triggerStats.some(t => t.name === "Stress" && t.frequency > 30)) {
      recommendations.push({
        id: "rec-relaxation",
        title: "Relaxation Techniques",
        description: "Stress appears to be a trigger for your pain. Consider trying guided meditation or deep breathing exercises.",
        type: "exercise",
        resourceLink: "/resources"
      });
    }
    
    if (triggerStats.some(t => t.name === "Physical Activity" && t.frequency > 30)) {
      recommendations.push({
        id: "rec-activity",
        title: "Activity Pacing",
        description: "Physical activity seems to trigger your pain. Learn about activity pacing to help manage your energy levels.",
        type: "tip",
        resourceLink: "/resources"
      });
    }
    
    // If no specific recommendations, provide general ones
    if (recommendations.length === 0) {
      recommendations.push({
        id: "rec-general",
        title: "Pain Education",
        description: "Understanding pain mechanisms can help you manage your symptoms better. Check out our educational resources.",
        type: "tip",
        resourceLink: "/resources"
      });
    }
    
    return recommendations.slice(0, 2); // Return only top 2 recommendations
  }

  async getResources(): Promise<Resource[]> {
    return Array.from(this.resources.values());
  }

  async getReportsByUserId(userId: number): Promise<Report[]> {
    // Filter reports for the specific user
    return Array.from(this.reports.values())
      .filter(report => {
        // Reports would normally have a userId field
        // For this example, we'll just return all reports
        return true;
      })
      .sort((a, b) => new Date(b.generatedOn).getTime() - new Date(a.generatedOn).getTime());
  }

  private initializeResources() {
    const resources: Resource[] = [
      {
        id: "res-1",
        title: "Understanding Chronic Pain",
        description: "Learn about the mechanisms of chronic pain and how it differs from acute pain.",
        type: "article",
        source: "National Institute of Health",
        url: "https://www.nih.gov/health-information/pain",
        tags: ["Education", "Chronic Pain"]
      },
      {
        id: "res-2",
        title: "Guided Meditation for Pain Relief",
        description: "A 15-minute guided meditation designed to help manage pain through mindfulness.",
        type: "video",
        source: "Pain Management Center",
        url: "https://www.youtube.com/watch?v=1vx8iUvfyCY",
        tags: ["Meditation", "Mindfulness", "Relaxation"]
      },
      {
        id: "res-3",
        title: "Gentle Stretching Exercises for Back Pain",
        description: "Safe stretching routines that can help alleviate back pain and improve mobility.",
        type: "exercise",
        source: "American Physical Therapy Association",
        url: "https://www.choosept.com/guide/physical-therapy-guide-low-back-pain",
        tags: ["Exercise", "Back Pain", "Stretching"]
      },
      {
        id: "res-4",
        title: "Pain and Sleep: Breaking the Cycle",
        description: "How pain affects sleep and practical strategies to improve sleep quality.",
        type: "article",
        source: "Sleep Foundation",
        url: "https://www.sleepfoundation.org/physical-health/pain-and-sleep",
        tags: ["Sleep", "Health Tips"]
      },
      {
        id: "res-5",
        title: "Cognitive Behavioral Therapy for Pain Management",
        description: "Introduction to cognitive-behavioral techniques for coping with chronic pain.",
        type: "guide",
        source: "American Psychological Association",
        url: "https://www.apa.org/topics/pain/chronic",
        tags: ["CBT", "Mental Health", "Coping Strategies"]
      }
    ];
    
    resources.forEach(resource => {
      this.resources.set(resource.id, resource);
    });
    
    // Sample report
    const sampleReport: Report = {
      id: "report-1",
      generatedOn: new Date().toISOString(),
      periodStart: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
      periodEnd: new Date().toISOString(),
      painEntries: 5,
      averagePain: 6.4,
      mostCommonLocation: "Lower Back",
      mostCommonTrigger: "Poor Sleep",
      data: {} // Would contain detailed report data
    };
    
    this.reports.set(sampleReport.id, sampleReport);
  }
}

class MemStorage implements IStorage {
  private users: Map<number, User>;
  private painEntries: Map<number, PainEntry>;
  private medications: Map<number, Medication>;
  private medicationTaken: Map<string, boolean>;
  private resources: Map<string, Resource>;
  private reports: Map<string, Report>;
  private reminderSettings: Map<number, ReminderSettings>;
  private currentUserId: number;
  private currentPainEntryId: number;
  private currentMedicationId: number;
  sessionStore: ReturnType<typeof createMemoryStore>;

  constructor() {
    this.users = new Map();
    this.painEntries = new Map();
    this.medications = new Map();
    this.medicationTaken = new Map();
    this.resources = new Map();
    this.reports = new Map();
    this.reminderSettings = new Map();
    this.currentUserId = 1;
    this.currentPainEntryId = 1;
    this.currentMedicationId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    this.initializeResources();
    console.log('Storage initialized with in-memory session store');
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      email: insertUser.email || null,
      profileCreated: false,
      medicalHistory: [],
      painBackground: null,
      age: null,
      gender: null,
      height: null,
      weight: null,
      allergies: [],
      currentMedications: [],
      chronicConditions: [],
      activityLevel: null,
      occupation: null,
      primaryDoctor: null,
      preferredResources: []
    };
    
    this.users.set(id, user);
    
    // Create default medication
    await this.createMedication({
      userId: user.id,
      name: "Ibuprofen",
      dosage: "400mg",
      frequency: "As needed",
      timeOfDay: ["Morning", "Evening"],
    });
    
    // Create sample report for new users
    const sampleReport: Report = {
      id: "report-sample",
      generatedOn: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      periodStart: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      periodEnd: format(new Date(), "yyyy-MM-dd"),
      painEntries: 5,
      averagePain: 6,
      mostCommonLocation: "Lower Back",
      mostCommonTrigger: "Stress",
      data: {}
    };
    this.reports.set(sampleReport.id, sampleReport);
    
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { ...user, ...userData, profileCreated: true };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createPainEntry(entry: InsertPainEntry): Promise<PainEntry> {
    const id = this.currentPainEntryId++;
    const painEntry: PainEntry = {
      id,
      userId: entry.userId,
      date: entry.date || new Date(),
      intensity: entry.intensity,
      locations: entry.locations || [],
      characteristics: entry.characteristics || null,
      triggers: entry.triggers || null,
      notes: entry.notes || null,
      medicationTaken: entry.medicationTaken || false,
      medications: entry.medications || null
    };
    this.painEntries.set(id, painEntry);
    return painEntry;
  }

  async getPainEntriesByUserId(userId: number): Promise<PainEntry[]> {
    return Array.from(this.painEntries.values())
      .filter(entry => entry.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getRecentPainEntries(userId: number, limit: number): Promise<PainEntry[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    return entries.slice(0, limit);
  }

  async getPainTrend(userId: number, days: number): Promise<PainEntry[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    const now = new Date();
    const filteredEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      const diffTime = Math.abs(now.getTime() - entryDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= days;
    });
    
    return filteredEntries;
  }

  async getTriggerStats(userId: number): Promise<TriggerStat[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    const triggerCounts = new Map<string, number>();
    
    // Count occurrences of each trigger
    entries.forEach(entry => {
      if (entry.triggers && (entry.triggers as string[]).length > 0) {
        (entry.triggers as string[]).forEach(trigger => {
          triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
        });
      }
    });
    
    // Convert to array and calculate frequencies
    const total = entries.length || 1; // Avoid division by zero
    const triggerStats: TriggerStat[] = Array.from(triggerCounts.entries())
      .map(([name, count]) => ({
        name,
        frequency: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.frequency - a.frequency);
    
    // If no entries yet, return some default triggers
    if (triggerStats.length === 0) {
      return [
        { name: "Poor Sleep", frequency: 75 },
        { name: "Stress", frequency: 60 },
        { name: "Physical Activity", frequency: 45 },
        { name: "Weather Changes", frequency: 30 },
        { name: "Diet", frequency: 15 }
      ];
    }
    
    return triggerStats;
  }

  async getPatterns(userId: number): Promise<Pattern[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    
    // Only generate patterns if there are enough entries
    if (entries.length < 5) {
      return [];
    }
    
    // Analyze entries for patterns
    // This is a simplified version - in a real app, this would be more sophisticated
    const patterns: Pattern[] = [];
    
    // Check for time of day pattern
    const morningEntries = entries.filter(e => {
      const hour = new Date(e.date).getHours();
      return hour >= 5 && hour < 12;
    }).length;
    
    const afternoonEntries = entries.filter(e => {
      const hour = new Date(e.date).getHours();
      return hour >= 12 && hour < 18;
    }).length;
    
    const eveningEntries = entries.filter(e => {
      const hour = new Date(e.date).getHours();
      return hour >= 18 || hour < 5;
    }).length;
    
    const totalEntries = entries.length;
    
    if (morningEntries / totalEntries > 0.5) {
      patterns.push({
        id: "pattern-morning",
        title: "Morning Pain Pattern",
        description: "You frequently experience pain in the morning hours. This could be related to sleep position or morning stiffness.",
        confidence: Math.round((morningEntries / totalEntries) * 100),
        source: "Time-based analysis"
      });
    } else if (eveningEntries / totalEntries > 0.5) {
      patterns.push({
        id: "pattern-evening",
        title: "Evening Pain Pattern",
        description: "Your pain tends to worsen in the evening hours. This could be related to daily fatigue or activity buildup.",
        confidence: Math.round((eveningEntries / totalEntries) * 100),
        source: "Time-based analysis"
      });
    }
    
    // Check for trigger patterns
    const triggerStats = await this.getTriggerStats(userId);
    if (triggerStats.length > 0 && triggerStats[0].frequency > 40) {
      patterns.push({
        id: "pattern-trigger",
        title: `${triggerStats[0].name} Correlation`,
        description: `There appears to be a strong correlation between your pain and ${triggerStats[0].name.toLowerCase()}. Consider tracking this trigger more closely.`,
        confidence: triggerStats[0].frequency,
        source: "Trigger correlation analysis"
      });
    }
    
    return patterns;
  }

  async createMedication(medication: InsertMedication): Promise<Medication> {
    const id = this.currentMedicationId++;
    const newMedication: Medication = {
      id,
      userId: medication.userId,
      name: medication.name,
      dosage: medication.dosage || null,
      frequency: medication.frequency || null,
      timeOfDay: medication.timeOfDay || null,
      active: medication.active !== undefined ? medication.active : true
    };
    this.medications.set(id, newMedication);
    return newMedication;
  }

  async getMedicationsByUserId(userId: number): Promise<Medication[]> {
    return Array.from(this.medications.values())
      .filter(med => med.userId === userId && med.active);
  }

  async getTodayMedications(userId: number): Promise<MedicationWithStatus[]> {
    const meds = await this.getMedicationsByUserId(userId);
    const today = format(new Date(), "yyyy-MM-dd");
    
    return meds.map(med => {
      const timeOfDay = med.timeOfDay as string[];
      const takenToday = timeOfDay ? timeOfDay.map((_, index) => {
        const key = `${med.id}-${today}-${index}`;
        return this.medicationTaken.get(key) || false;
      }) : [];
      
      return {
        ...med,
        takenToday
      };
    });
  }

  async takeMedication(medicationId: number, doseIndex: number): Promise<any> {
    const medication = Array.from(this.medications.values())
      .find(med => med.id === medicationId);
    
    if (!medication) {
      throw new Error("Medication not found");
    }
    
    const today = format(new Date(), "yyyy-MM-dd");
    const key = `${medicationId}-${today}-${doseIndex}`;
    this.medicationTaken.set(key, true);
    
    return { success: true, medicationId, doseIndex };
  }

  async getRecommendations(userId: number): Promise<Recommendation[]> {
    const entries = await this.getPainEntriesByUserId(userId);
    
    // Default recommendations if no entries yet
    if (entries.length === 0) {
      return [
        {
          id: "rec-sleep",
          title: "Sleep Improvement",
          description: "Maintaining a consistent sleep schedule can help reduce pain levels for many conditions.",
          type: "tip",
          resourceLink: "/resources"
        },
        {
          id: "rec-relaxation",
          title: "Relaxation Techniques",
          description: "Stress reduction through meditation or deep breathing can help manage pain.",
          type: "exercise",
          resourceLink: "/resources"
        }
      ];
    }
    
    // Generate personalized recommendations based on user data
    const recommendations: Recommendation[] = [];
    const triggerStats = await this.getTriggerStats(userId);
    
    if (triggerStats.some(t => t.name === "Poor Sleep" && t.frequency > 30)) {
      recommendations.push({
        id: "rec-sleep",
        title: "Sleep Improvement",
        description: "Your logs show a correlation between poor sleep and increased pain. Try maintaining a consistent sleep schedule.",
        type: "tip",
        resourceLink: "/resources"
      });
    }
    
    if (triggerStats.some(t => t.name === "Stress" && t.frequency > 30)) {
      recommendations.push({
        id: "rec-relaxation",
        title: "Relaxation Techniques",
        description: "Stress appears to be a trigger for your pain. Consider trying guided meditation or deep breathing exercises.",
        type: "exercise",
        resourceLink: "/resources"
      });
    }
    
    if (triggerStats.some(t => t.name === "Physical Activity" && t.frequency > 30)) {
      recommendations.push({
        id: "rec-activity",
        title: "Activity Pacing",
        description: "Physical activity seems to trigger your pain. Learn about activity pacing to help manage your energy levels.",
        type: "tip",
        resourceLink: "/resources"
      });
    }
    
    // If no specific recommendations, provide general ones
    if (recommendations.length === 0) {
      recommendations.push({
        id: "rec-general",
        title: "Pain Education",
        description: "Understanding pain mechanisms can help you manage your symptoms better. Check out our educational resources.",
        type: "tip",
        resourceLink: "/resources"
      });
    }
    
    return recommendations.slice(0, 2); // Return only top 2 recommendations
  }

  async getResources(): Promise<Resource[]> {
    return Array.from(this.resources.values());
  }

  async getReportsByUserId(userId: number): Promise<Report[]> {
    // Filter reports for the specific user
    return Array.from(this.reports.values())
      .filter(report => {
        // Reports would normally have a userId field
        // For this example, we'll just return all reports
        return true;
      })
      .sort((a, b) => new Date(b.generatedOn).getTime() - new Date(a.generatedOn).getTime());
  }

  private initializeResources() {
    const resources: Resource[] = [
      {
        id: "res-1",
        title: "Understanding Chronic Pain",
        description: "Learn about the mechanisms of chronic pain and how it differs from acute pain.",
        type: "article",
        source: "National Institute of Health",
        url: "https://www.nih.gov/health-information/pain",
        tags: ["Education", "Chronic Pain"]
      },
      {
        id: "res-2",
        title: "Guided Meditation for Pain Relief",
        description: "A 15-minute guided meditation designed to help manage pain through mindfulness.",
        type: "video",
        source: "Pain Management Center",
        url: "https://www.youtube.com/watch?v=1vx8iUvfyCY",
        tags: ["Meditation", "Mindfulness", "Relaxation"]
      },
      {
        id: "res-3",
        title: "Gentle Stretching Exercises for Back Pain",
        description: "Safe stretching routines that can help alleviate back pain and improve mobility.",
        type: "exercise",
        source: "American Physical Therapy Association",
        url: "https://www.choosept.com/resources/detail/top-3-exercises-to-prevent-or-reduce-low-back-pain",
        tags: ["Exercise", "Back Pain", "Stretching"]
      },
      {
        id: "res-4",
        title: "Pain Tracking: How and Why It Helps",
        description: "Learn why keeping a detailed pain journal can help identify patterns and improve treatment outcomes.",
        type: "article",
        source: "PainClinics.com",
        url: "https://www.example.com/pain-tracking-guide",
        tags: ["Education", "Self-Management", "Tracking"]
      },
      {
        id: "res-5",
        title: "Understanding Pain Medications",
        description: "A comprehensive guide to different types of pain medications, their uses, benefits, and potential side effects.",
        type: "guide",
        source: "American Chronic Pain Association",
        url: "https://www.theacpa.org/pain-management/medication-and-treatment/",
        tags: ["Medication", "Education", "Treatment"]
      }
    ];
    
    resources.forEach(resource => {
      this.resources.set(resource.id, resource);
    });
    
    // Initialize sample report
    const sampleReport: Report = {
      id: "report-1",
      generatedOn: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      periodStart: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      periodEnd: format(new Date(), "yyyy-MM-dd"),
      painEntries: 12,
      averagePain: 5.8,
      mostCommonLocation: "Lower Back",
      mostCommonTrigger: "Physical Activity",
      data: {}
    };
    this.reports.set(sampleReport.id, sampleReport);
  }
}

export const storage = new MemStorage();
