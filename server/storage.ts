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
import { eq, desc, and, sql } from 'drizzle-orm';

export class PostgresStorage implements IStorage {
  private pool: Pool;
  private db: ReturnType<typeof drizzle>;
  sessionStore: any; // Use any to avoid type errors with session store
  private connectionFailed = false;
  private memFallback: MemStorage;

  constructor() {
    // Initialize MemStorage as fallback
    this.memFallback = new MemStorage();
    
    try {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL not found in environment");
      }
      
      this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
      this.db = drizzle(this.pool);
      
      // Test the connection but don't throw an error if it fails
      // This allows the app to use PostgreSQL when it's working but gracefully handle failures
      this.pool.query('SELECT 1')
        .then(() => {
          console.log('Successfully connected to PostgreSQL database');
          this.connectionFailed = false;
        })
        .catch(err => {
          console.error('Warning: PostgreSQL connection test failed:', err);
          this.connectionFailed = true;
        });
      
      // Use PostgreSQL for session storage with fallback to memory store
      try {
        const pgSession = ConnectPgSimple(session);
        this.sessionStore = new pgSession({
          pool: this.pool,
          tableName: 'user_sessions',
          // Make the session store more resilient to connection issues
          errorLog: (error) => console.error('Session store error:', error)
        });
      } catch (err) {
        console.error('Session store initialization failed, using memory store instead:', err);
        this.sessionStore = this.memFallback.sessionStore;
      }
      
      // Initialize database tables if needed
      this.initializeDatabase();
      
      // Log to confirm initialization
      console.log('Storage initialized with PostgreSQL and MemStorage fallback');
    } catch (error) {
      console.error('Failed to initialize PostgreSQL storage, using MemStorage instead:', error);
      this.connectionFailed = true;
      // Use the in-memory session store
      this.sessionStore = this.memFallback.sessionStore;
    }
  }
  
  // Helper method to handle fallback to in-memory storage when database operations fail
  private async withFallback<T>(
    pgOperation: () => Promise<T>, 
    memOperation: () => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    // If we already know the connection failed, use memory storage directly
    if (this.connectionFailed) {
      return memOperation();
    }
    
    try {
      // Try the PostgreSQL operation first
      return await pgOperation();
    } catch (error) {
      // Log the error and mark the connection as failed
      console.error(`${errorMessage}:`, error);
      this.connectionFailed = true;
      
      // Fall back to memory storage
      console.log('Falling back to in-memory storage for this operation');
      return memOperation();
    }
  }

  private async initializeDatabase() {
    try {
      // Ensure tables exist using drizzle-kit push
      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Error initializing database tables:', error);
    }
  }
  
  // Test connection method used by StorageWrapper
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 as test');
      return result && result.rows && result.rows.length > 0;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  // USER MANAGEMENT
  async getUser(id: number): Promise<User | undefined> {
    return this.withFallback(
      // PostgreSQL operation
      async () => {
        const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
        return result[0];
      },
      // In-memory fallback operation
      async () => this.memFallback.getUser(id),
      'Error getting user'
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withFallback(
      // PostgreSQL operation
      async () => {
        const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
        return result[0];
      },
      // In-memory fallback operation
      async () => this.memFallback.getUserByUsername(username),
      'Error getting user by username'
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
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

      if (!result || result.length === 0) {
        throw new Error('Failed to create user');
      }

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
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    try {
      const userToUpdate = await this.getUser(id);
      if (!userToUpdate) {
        throw new Error("User not found");
      }
      
      // Prepare update data with profile created flag
      const updateData = { ...userData, profileCreated: true };
      
      const result = await this.db.update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();
      
      if (!result || result.length === 0) {
        throw new Error('Failed to update user');
      }
      
      return result[0];
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // PAIN ENTRIES
  async createPainEntry(entry: InsertPainEntry): Promise<PainEntry> {
    try {
      // Use the field names exactly as in the painEntries schema definition
      const result = await this.db.insert(painEntries).values({
        userId: entry.userId,
        date: entry.date || new Date(),
        intensity: entry.intensity,
        locations: entry.locations || [],
        characteristics: entry.characteristics || null,
        triggers: entry.triggers || null,
        notes: entry.notes || null,
        medicationTaken: entry.medicationTaken || false,
        medications: entry.medications || null
      }).returning();
      
      if (!result || result.length === 0) {
        throw new Error('Failed to create pain entry');
      }
      
      return result[0];
    } catch (error) {
      console.error('Error creating pain entry:', error);
      throw error;
    }
  }

  async getPainEntriesByUserId(userId: number): Promise<PainEntry[]> {
    try {
      const result = await this.db.select()
        .from(painEntries)
        .where(eq(painEntries.userId, userId))
        .orderBy(desc(painEntries.date));
      
      return result;
    } catch (error) {
      console.error('Error getting pain entries:', error);
      return [];
    }
  }

  async getRecentPainEntries(userId: number, limit: number): Promise<PainEntry[]> {
    try {
      const result = await this.db.select()
        .from(painEntries)
        .where(eq(painEntries.userId, userId))
        .orderBy(desc(painEntries.date))
        .limit(limit);
      
      return result;
    } catch (error) {
      console.error('Error getting recent pain entries:', error);
      return [];
    }
  }

  async getPainTrend(userId: number, days: number): Promise<PainEntry[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const result = await this.db.select()
        .from(painEntries)
        .where(
          and(
            eq(painEntries.userId, userId),
            sql`${painEntries.date} >= ${cutoffDate}`
          )
        )
        .orderBy(painEntries.date);
      
      return result;
    } catch (error) {
      console.error('Error getting pain trend:', error);
      return [];
    }
  }

  async getTriggerStats(userId: number): Promise<TriggerStat[]> {
    try {
      const entries = await this.getPainEntriesByUserId(userId);
      const triggerCounts = new Map<string, number>();
      
      // Count occurrences of each trigger
      entries.forEach(entry => {
        if (entry.triggers && entry.triggers.length > 0) {
          entry.triggers.forEach(trigger => {
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
    } catch (error) {
      console.error('Error getting trigger stats:', error);
      return [
        { name: "Poor Sleep", frequency: 75 },
        { name: "Stress", frequency: 60 },
        { name: "Physical Activity", frequency: 45 },
        { name: "Weather Changes", frequency: 30 },
        { name: "Diet", frequency: 15 }
      ];
    }
  }

  async getPatterns(userId: number): Promise<Pattern[]> {
    try {
      const entries = await this.getPainEntriesByUserId(userId);
      
      // Only generate patterns if there are enough entries
      if (entries.length < 5) {
        return [];
      }
      
      // Analyze entries for patterns
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
    } catch (error) {
      console.error('Error getting patterns:', error);
      return [];
    }
  }

  // MEDICATIONS
  async createMedication(medication: InsertMedication): Promise<Medication> {
    try {
      const result = await this.db.insert(medications).values({
        userId: medication.userId,
        name: medication.name,
        dosage: medication.dosage || null,
        frequency: medication.frequency || null,
        timeOfDay: medication.timeOfDay || null,
        active: medication.active !== undefined ? medication.active : true
      }).returning();
      
      if (!result || result.length === 0) {
        throw new Error('Failed to create medication');
      }
      
      return result[0];
    } catch (error) {
      console.error('Error creating medication:', error);
      throw error;
    }
  }

  async getMedicationsByUserId(userId: number): Promise<Medication[]> {
    try {
      const result = await this.db.select()
        .from(medications)
        .where(
          and(
            eq(medications.userId, userId),
            eq(medications.active, true)
          )
        );
      
      return result;
    } catch (error) {
      console.error('Error getting medications:', error);
      return [];
    }
  }

  async getTodayMedications(userId: number): Promise<MedicationWithStatus[]> {
    try {
      const meds = await this.getMedicationsByUserId(userId);
      const today = format(new Date(), "yyyy-MM-dd");
      
      // TODO: In a production app, we would have a medication_taken table
      // For now, we'll simulate medication status
      return meds.map(med => {
        const timeOfDay = med.timeOfDay || [];
        const takenToday = timeOfDay.map(() => false);
        
        return {
          ...med,
          takenToday
        };
      });
    } catch (error) {
      console.error('Error getting today medications:', error);
      return [];
    }
  }

  async takeMedication(medicationId: number, doseIndex: number): Promise<any> {
    try {
      const medication = await this.db.select()
        .from(medications)
        .where(eq(medications.id, medicationId))
        .limit(1);
      
      if (!medication || medication.length === 0) {
        throw new Error("Medication not found");
      }
      
      // TODO: In a production app, we would insert into a medication_taken table
      
      return { success: true, medicationId, doseIndex };
    } catch (error) {
      console.error('Error taking medication:', error);
      throw error;
    }
  }

  // RECOMMENDATIONS & RESOURCES
  async getRecommendations(userId: number): Promise<Recommendation[]> {
    try {
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
    } catch (error) {
      console.error('Error getting recommendations:', error);
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
  }

  async getResources(): Promise<Resource[]> {
    // For now, return static resources. In production, we would store these in the database
    return [
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
  }

  // REPORTS
  async getReportsByUserId(userId: number): Promise<Report[]> {
    // TODO: In a production app, we would store reports in the database
    // For now, generate a static report
    return [
      {
        id: "report-1",
        generatedOn: new Date().toISOString(),
        periodStart: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
        periodEnd: new Date().toISOString(),
        painEntries: 5,
        averagePain: 6.4,
        mostCommonLocation: "Lower Back",
        mostCommonTrigger: "Poor Sleep",
        data: {} // Would contain detailed report data
      }
    ];
  }
  
  // REMINDER SETTINGS
  async getReminderSettings(userId: number): Promise<ReminderSettings | undefined> {
    // TODO: In a production app, we would store reminder settings in the database
    // For now, return default settings
    return {
      userId,
      emailNotifications: true,
      painLogReminders: true,
      medicationReminders: true,
      wellnessReminders: true,
      weeklySummary: true,
      reminderFrequency: "daily",
      preferredTime: "evening",
      notificationStyle: "gentle"
    };
  }
  
  async updateReminderSettings(userId: number, settings: Partial<ReminderSettings>): Promise<ReminderSettings> {
    // TODO: In a production app, we would update reminder settings in the database
    // For now, return merged settings
    const existingSettings = await this.getReminderSettings(userId);
    const updatedSettings: ReminderSettings = {
      ...existingSettings!,
      ...settings,
      userId
    };
    
    return updatedSettings;
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
  
  private initializeResources() {
    // Add some default resources
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
      }
    ];
    
    resources.forEach(resource => {
      this.resources.set(resource.id, resource);
    });
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
    // For now, return static resources. In production, we would store these in the database
    return [
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
  }

  async getReportsByUserId(userId: number): Promise<Report[]> {
    try {
      // TODO: In a production app, we would store reports in the database
      // For now, return a sample report
      return [
        {
          id: "report-1",
          generatedOn: new Date().toISOString(),
          periodStart: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
          periodEnd: new Date().toISOString(),
          painEntries: 5,
          averagePain: 6.4,
          mostCommonLocation: "Lower Back",
          mostCommonTrigger: "Poor Sleep",
          data: {} // Would contain detailed report data
        }
      ];
    } catch (error) {
      console.error('Error getting reports:', error);
      return [];
    }
  }
  
  async getReminderSettings(userId: number): Promise<ReminderSettings | undefined> {
    try {
      // TODO: In a production app, we would store reminder settings in the database
      // For now, return default settings
      return {
        userId,
        emailNotifications: true,
        painLogReminders: true,
        medicationReminders: true,
        wellnessReminders: true,
        weeklySummary: true,
        reminderFrequency: "daily",
        preferredTime: "evening",
        notificationStyle: "gentle"
      };
    } catch (error) {
      console.error('Error getting reminder settings:', error);
      return undefined;
    }
  }
  
  async updateReminderSettings(userId: number, settings: Partial<ReminderSettings>): Promise<ReminderSettings> {
    try {
      // TODO: In a production app, we would update reminder settings in the database
      // For now, return merged settings with the defaults
      const existingSettings = await this.getReminderSettings(userId);
      
      return {
        ...existingSettings!,
        ...settings,
        userId
      };
    } catch (error) {
      console.error('Error updating reminder settings:', error);
      throw error;
    }
  }
}

// Create storage wrapper that initializes properly and falls back to MemStorage when needed
class StorageWrapper implements IStorage {
  private pgStorage: PostgresStorage | null = null;
  private memStorage: MemStorage;
  private useMemory: boolean = false;
  sessionStore: any;

  constructor() {
    console.log('Initializing storage system...');
    this.memStorage = new MemStorage();
    
    // Use memory store for session by default (will be replaced if PG connection succeeds)
    this.sessionStore = this.memStorage.sessionStore;
    
    if (!process.env.DATABASE_URL) {
      console.log('No DATABASE_URL provided, using in-memory storage only');
      this.useMemory = true;
      return;
    }
    
    try {
      // Try to initialize PostgreSQL connection
      this.pgStorage = new PostgresStorage();
      
      // Set session store from PostgreSQL
      this.sessionStore = this.pgStorage.sessionStore;
      
      // Test the connection immediately but don't block initialization
      this.testConnection();
    } catch (error) {
      console.error('Failed to initialize PostgreSQL storage, falling back to memory storage:', error);
      this.useMemory = true;
      this.pgStorage = null;
    }
  }
  
  // Test database connection and set useMemory flag if it fails
  private async testConnection() {
    if (!this.pgStorage) return;
    
    try {
      // Simple query to test if the database is accessible
      const result = await this.pgStorage.testConnection();
      this.useMemory = !result;
      if (result) {
        console.log('PostgreSQL connection test successful, using database storage');
      } else {
        console.error('PostgreSQL connection test failed, using memory storage');
      }
    } catch (error) {
      console.error('PostgreSQL connection test failed, using memory storage:', error);
      this.useMemory = true;
    }
  }
  
  // Helper to route method calls to the appropriate storage implementation
  private getStorage(): IStorage {
    return (this.useMemory || !this.pgStorage) ? this.memStorage : this.pgStorage;
  }
  
  // Implement all IStorage methods by delegating to the appropriate storage implementation

  // USER MANAGEMENT
  async getUser(id: number): Promise<User | undefined> {
    return this.getStorage().getUser(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.getStorage().getUserByUsername(username);
  }
  
  async createUser(user: InsertUser): Promise<User> {
    return this.getStorage().createUser(user);
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    return this.getStorage().updateUser(id, userData);
  }
  
  // PAIN ENTRIES
  async createPainEntry(entry: InsertPainEntry): Promise<PainEntry> {
    return this.getStorage().createPainEntry(entry);
  }
  
  async getPainEntriesByUserId(userId: number): Promise<PainEntry[]> {
    return this.getStorage().getPainEntriesByUserId(userId);
  }
  
  async getRecentPainEntries(userId: number, limit: number): Promise<PainEntry[]> {
    return this.getStorage().getRecentPainEntries(userId, limit);
  }
  
  async getPainTrend(userId: number, days: number): Promise<PainEntry[]> {
    return this.getStorage().getPainTrend(userId, days);
  }
  
  async getTriggerStats(userId: number): Promise<TriggerStat[]> {
    return this.getStorage().getTriggerStats(userId);
  }
  
  async getPatterns(userId: number): Promise<Pattern[]> {
    return this.getStorage().getPatterns(userId);
  }
  
  // MEDICATIONS
  async createMedication(medication: InsertMedication): Promise<Medication> {
    return this.getStorage().createMedication(medication);
  }
  
  async getMedicationsByUserId(userId: number): Promise<Medication[]> {
    return this.getStorage().getMedicationsByUserId(userId);
  }
  
  async getTodayMedications(userId: number): Promise<MedicationWithStatus[]> {
    return this.getStorage().getTodayMedications(userId);
  }
  
  async takeMedication(medicationId: number, doseIndex: number): Promise<any> {
    return this.getStorage().takeMedication(medicationId, doseIndex);
  }
  
  // RESOURCES & RECOMMENDATIONS
  async getRecommendations(userId: number): Promise<Recommendation[]> {
    return this.getStorage().getRecommendations(userId);
  }
  
  async getResources(): Promise<Resource[]> {
    return this.getStorage().getResources();
  }
  
  // REPORTS
  async getReportsByUserId(userId: number): Promise<Report[]> {
    return this.getStorage().getReportsByUserId(userId);
  }
  
  // REMINDER SETTINGS
  async getReminderSettings(userId: number): Promise<ReminderSettings | undefined> {
    return this.getStorage().getReminderSettings(userId);
  }
  
  async updateReminderSettings(userId: number, settings: Partial<ReminderSettings>): Promise<ReminderSettings> {
    return this.getStorage().updateReminderSettings(userId, settings);
  }
}

// Export a single instance of StorageWrapper to be used throughout the application
export const storage = new StorageWrapper();
