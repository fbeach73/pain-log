import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { pool, checkDatabaseUrl } from "./db";
import { insertPainEntrySchema, insertMedicationSchema } from "@shared/schema";
import { PainTrendData } from "../client/src/types/pain";
import { format, subDays } from "date-fns";
import { generatePainLogPDF } from "./utils/pdf-generator";
import { initializeEmailService, sendEmailWithAttachment } from "./utils/email-service";
import { WordPressAPI } from "./services/wordpress-api";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize email service
  initializeEmailService();
  
  // Health check endpoints
  app.get("/api/system/health", (req, res) => {
    // Basic health check for system status - always return 200 OK
    res.status(200).json({ status: "ok", time: new Date() });
  });

  // Removed WordPress API endpoint
  
  // Only providing a basic health check endpoint for the production build
  
  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);
  
  // Add a maintenance endpoint for session cleanup (only available during development)
  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/maintenance/cleanup-sessions', async (req, res) => {
      try {
        // Clean up invalid sessions (like those with user ID 999)
        if (storage.sessionStore && typeof storage.sessionStore.destroy === 'function') {
          console.log('Attempting to clean up invalid sessions');
          // Clean up session with specific ID if provided
          if (req.query.sid) {
            await new Promise<void>((resolve, reject) => {
              storage.sessionStore.destroy(req.query.sid as string, (err) => {
                if (err) {
                  console.error('Error destroying specific session:', err);
                  reject(err);
                } else {
                  console.log(`Session ${req.query.sid} destroyed successfully`);
                  resolve();
                }
              });
            });
          }
          
          res.json({ success: true, message: 'Session cleanup completed' });
        } else {
          res.status(400).json({ success: false, message: 'Session store does not support cleanup' });
        }
      } catch (error) {
        console.error('Session cleanup error:', error);
        res.status(500).json({ success: false, error: String(error) });
      }
    });
  }

  // Pain Entries API
  app.post("/api/pain-entries", async (req, res) => {
    try {
      console.log("Received pain entry request:", {
        body: req.body,
        authenticated: req.isAuthenticated(),
        hasUserId: !!req.body.userId,
      });
      
      // Even if not authenticated via session, allow the request if userId is in the body
      if (!req.isAuthenticated() && !req.body.userId) {
        console.log("Pain entry creation failed: Not authenticated and no userId provided");
        return res.status(401).json({ message: "Authentication required. Please provide a valid userId." });
      }
      
      // Use the user ID from session if available, otherwise use the one from the request body
      const userId = req.isAuthenticated() ? req.user.id : req.body.userId;
      
      // Create a modified version of the insertPainEntrySchema that accepts string dates
      const modifiedSchema = insertPainEntrySchema.extend({
        date: z.string().or(z.date()).transform(val => {
          if (typeof val === 'string') {
            return new Date(val);
          }
          return val;
        })
      });
      
      // Prepare data for validation including the userId
      const painData = {
        ...req.body,
        userId: userId
      };
      
      console.log("Validating pain entry data with userId:", userId);
      
      // Validate and transform the data using our modified schema
      const validatedData = modifiedSchema.parse(painData);
      
      console.log("Pain entry data validated successfully with date:", validatedData.date);
      
      // Save the entry with the validated data
      const painEntry = await storage.createPainEntry(validatedData);
      console.log("Pain entry created successfully:", painEntry.id);
      res.status(201).json(painEntry);
    } catch (error) {
      console.error("Error creating pain entry:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create pain entry" });
    }
  });

  app.get("/api/pain-entries", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const painEntries = await storage.getPainEntriesByUserId(userId);
      res.json(painEntries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pain entries" });
    }
  });

  app.get("/api/pain-entries/recent", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const recentEntries = await storage.getRecentPainEntries(userId, 3);
      res.json(recentEntries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent pain entries" });
    }
  });

  app.get("/api/pain-entries/trend", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const period = req.query.period as string || "7days";
      
      let days = 7;
      if (period === "30days") days = 30;
      if (period === "90days") days = 90;
      
      const painTrend = await storage.getPainTrend(userId, days);
      
      // Format data for frontend
      const trendData: PainTrendData[] = [];
      for (let i = 0; i < 7; i++) {
        const day = format(subDays(new Date(), 6 - i), "E");
        const entry = painTrend.find(e => format(new Date(e.date), "E") === day);
        
        trendData.push({
          day,
          intensity: entry ? entry.intensity : 0
        });
      }
      
      res.json(trendData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pain trend" });
    }
  });

  app.get("/api/pain-entries/triggers", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const triggerStats = await storage.getTriggerStats(userId);
      res.json(triggerStats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trigger statistics" });
    }
  });

  app.get("/api/pain-entries/patterns", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const patterns = await storage.getPatterns(userId);
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pain patterns" });
    }
  });

  // Medications API
  app.post("/api/medications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      // Set userId from authenticated user
      const userId = req.user!.id;
      
      console.log("Received medication data:", JSON.stringify(req.body, null, 2));
      
      // Verify we have the required fields
      if (!req.body.name || req.body.name.trim() === '') {
        return res.status(400).json({ message: "Medication name is required" });
      }
      
      // Process timeOfDay to ensure it's always a proper array
      let timeOfDay: string[] = [];
      
      // Handle timeOfDay array processing
      if (req.body.timeOfDay) {
        if (Array.isArray(req.body.timeOfDay)) {
          // Filter out empty entries
          timeOfDay = req.body.timeOfDay
            .filter((time: unknown): time is string => 
              typeof time === 'string' && time.trim() !== ''
            );
        } else if (typeof req.body.timeOfDay === 'object') {
          // Convert object to array (handling form data serialization issues)
          timeOfDay = Object.values(req.body.timeOfDay)
            .filter((time: unknown): time is string => 
              typeof time === 'string' && time.trim() !== ''
            );
        } else if (typeof req.body.timeOfDay === 'string') {
          // Try to parse JSON string or treat as single value
          try {
            const parsed = JSON.parse(req.body.timeOfDay);
            if (Array.isArray(parsed)) {
              timeOfDay = parsed.filter((time: unknown): time is string => 
                typeof time === 'string' && time.trim() !== ''
              );
            } else if (typeof parsed === 'object') {
              timeOfDay = Object.values(parsed).filter((time: unknown): time is string => 
                typeof time === 'string' && time.trim() !== ''
              );
            }
          } catch (e) {
            // If parsing fails, use it as a single item
            if (req.body.timeOfDay.trim() !== '') {
              timeOfDay = [req.body.timeOfDay];
            }
          }
        }
      }
      
      // If timeOfDay is empty after all processing, set a default
      if (timeOfDay.length === 0) {
        timeOfDay = ["Morning"];
        console.log("Using default 'Morning' for timeOfDay");
      }
      
      console.log("Processed timeOfDay array:", timeOfDay);
      
      // Create a clean medication data object
      const medicationData = {
        userId: userId,
        name: req.body.name.trim(),
        dosage: req.body.dosage || null,
        frequency: req.body.frequency || null,
        timeOfDay: timeOfDay,
        active: req.body.active !== undefined ? req.body.active : true
      };
      
      console.log("Creating medication with processed data:", JSON.stringify(medicationData, null, 2));
      
      try {
        // Validate the data using schema
        const validatedData = insertMedicationSchema.parse(medicationData);
        const medication = await storage.createMedication(validatedData);
        console.log("Medication created successfully:", medication);
        
        res.status(201).json(medication);
      } catch (validationError) {
        console.error("Validation error:", validationError);
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({ message: validationError.message });
        }
        throw validationError; // Re-throw if it's not a Zod error
      }
    } catch (error) {
      console.error("Error creating medication:", error);
      res.status(500).json({ message: "Failed to create medication" });
    }
  });

  app.get("/api/medications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const medications = await storage.getMedicationsByUserId(userId);
      res.json(medications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch medications" });
    }
  });

  app.get("/api/medications/today", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const medications = await storage.getTodayMedications(userId);
      res.json(medications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch today's medications" });
    }
  });

  app.post("/api/medications/take", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { medicationId, doseIndex } = req.body;
      const result = await storage.takeMedication(medicationId, doseIndex);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to record medication taken" });
    }
  });

  // Recommendations API
  app.get("/api/recommendations", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const recommendations = await storage.getRecommendations(userId);
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Resources API
  app.get("/api/resources", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const resources = await storage.getResources();
      res.json(resources);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  // Reports API
  app.get("/api/reports", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const reports = await storage.getReportsByUserId(userId);
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Profile API
  app.get("/api/user/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const profile = await storage.getUser(userId);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.patch("/api/user/profile", async (req, res) => {
    try {
      console.log("Profile update request received");
      if (!req.isAuthenticated()) {
        console.log("Profile update: Unauthorized - user not authenticated");
        return res.sendStatus(401);
      }
      
      const userId = req.user!.id;
      console.log(`Profile update: Processing for user ID ${userId}`);
      
      const updateData = req.body;
      console.log(`Profile update data: ${JSON.stringify(updateData, null, 2)}`);
      
      // Check for any array type issues and fix them
      if (updateData.medicalHistory && !Array.isArray(updateData.medicalHistory)) {
        console.log("Converting medicalHistory to array");
        updateData.medicalHistory = Object.values(updateData.medicalHistory);
      }
      
      if (updateData.allergies && !Array.isArray(updateData.allergies)) {
        console.log("Converting allergies to array");
        updateData.allergies = Object.values(updateData.allergies);
      }
      
      if (updateData.currentMedications && !Array.isArray(updateData.currentMedications)) {
        console.log("Converting currentMedications to array");
        updateData.currentMedications = Object.values(updateData.currentMedications);
      }
      
      if (updateData.chronicConditions && !Array.isArray(updateData.chronicConditions)) {
        console.log("Converting chronicConditions to array");
        updateData.chronicConditions = Object.values(updateData.chronicConditions);
      }
      
      if (updateData.preferredResources && !Array.isArray(updateData.preferredResources)) {
        console.log("Converting preferredResources to array");
        updateData.preferredResources = Object.values(updateData.preferredResources);
      }
      
      console.log(`Profile update sanitized data: ${JSON.stringify(updateData, null, 2)}`);
      
      const updatedProfile = await storage.updateUser(userId, updateData);
      console.log("Profile update success:", JSON.stringify(updatedProfile, null, 2));
      res.json(updatedProfile);
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ 
        message: "Failed to update user profile", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Reminder Settings API
  app.get("/api/user/reminder-settings", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const reminderSettings = await storage.getReminderSettings(userId);
      res.json(reminderSettings);
    } catch (error) {
      console.error("Error fetching reminder settings:", error);
      res.status(500).json({ message: "Failed to fetch reminder settings" });
    }
  });
  
  app.patch("/api/user/reminder-settings", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const settingsData = req.body;
      const updatedSettings = await storage.updateReminderSettings(userId, settingsData);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating reminder settings:", error);
      res.status(500).json({ message: "Failed to update reminder settings" });
    }
  });
  
  // PDF report download endpoint
  app.get("/api/reports/:reportId/download", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Unauthorized");
      }

      const { reportId } = req.params;
      
      // Get user data
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).send("User ID not found");
      }

      // Fetch pain entries for the user
      const painEntries = await storage.getPainEntriesByUserId(userId);
      if (!painEntries || painEntries.length === 0) {
        return res.status(404).send("No pain entries found for this user");
      }

      // Get user's name
      const user = await storage.getUser(userId);
      const userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || "User";

      // Calculate report date range
      const now = new Date();
      let periodStart: string;
      let periodEnd: string;

      // Set different date ranges based on reportId
      if (reportId === 'last-week') {
        periodStart = format(subDays(now, 7), 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
      } else if (reportId === 'last-month') {
        periodStart = format(subDays(now, 30), 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
      } else if (reportId === 'last-3-months') {
        periodStart = format(subDays(now, 90), 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
      } else if (reportId === 'all-time') {
        // Find earliest entry date
        const dates = painEntries.map(e => new Date(e.date).getTime());
        const earliestDate = new Date(Math.min(...dates));
        periodStart = format(earliestDate, 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
      } else {
        // Default to all time if report ID doesn't match
        const dates = painEntries.map(e => new Date(e.date).getTime());
        const earliestDate = new Date(Math.min(...dates));
        periodStart = format(earliestDate, 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
      }

      // Filter entries based on date range
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      endDate.setHours(23, 59, 59, 999); // Include the entire end day

      const filteredEntries = painEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= startDate && entryDate <= endDate;
      });

      if (filteredEntries.length === 0) {
        return res.status(404).send("No pain entries found for the selected time period");
      }

      // Generate PDF
      const pdfBuffer = await generatePainLogPDF(
        filteredEntries,
        userName,
        format(startDate, 'MMMM d, yyyy'),
        format(endDate, 'MMMM d, yyyy')
      );

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=pain-log-report-${reportId}.pdf`);
      
      // Send the PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF report:", error);
      res.status(500).send("Error generating report");
    }
  });

  // Email report endpoint
  app.post("/api/reports/:reportId/email", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Unauthorized");
      }

      const { reportId } = req.params;
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).send("Email address is required");
      }

      // Get user data
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).send("User ID not found");
      }

      // Fetch pain entries for the user
      const painEntries = await storage.getPainEntriesByUserId(userId);
      if (!painEntries || painEntries.length === 0) {
        return res.status(404).send("No pain entries found for this user");
      }

      // Get user's name
      const user = await storage.getUser(userId);
      const userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || "User";

      // Calculate report date range
      const now = new Date();
      let periodStart: string;
      let periodEnd: string;
      let periodName: string;

      // Set different date ranges based on reportId
      if (reportId === 'last-week') {
        periodStart = format(subDays(now, 7), 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
        periodName = "Last Week";
      } else if (reportId === 'last-month') {
        periodStart = format(subDays(now, 30), 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
        periodName = "Last Month";
      } else if (reportId === 'last-3-months') {
        periodStart = format(subDays(now, 90), 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
        periodName = "Last 3 Months";
      } else if (reportId === 'all-time') {
        // Find earliest entry date
        const dates = painEntries.map(e => new Date(e.date).getTime());
        const earliestDate = new Date(Math.min(...dates));
        periodStart = format(earliestDate, 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
        periodName = "All Time";
      } else {
        // Default to all time if report ID doesn't match
        const dates = painEntries.map(e => new Date(e.date).getTime());
        const earliestDate = new Date(Math.min(...dates));
        periodStart = format(earliestDate, 'yyyy-MM-dd');
        periodEnd = format(now, 'yyyy-MM-dd');
        periodName = "All Time";
      }

      // Filter entries based on date range
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      endDate.setHours(23, 59, 59, 999); // Include the entire end day

      const filteredEntries = painEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= startDate && entryDate <= endDate;
      });

      if (filteredEntries.length === 0) {
        return res.status(404).send("No pain entries found for the selected time period");
      }

      // Generate PDF
      const pdfBuffer = await generatePainLogPDF(
        filteredEntries,
        userName,
        format(startDate, 'MMMM d, yyyy'),
        format(endDate, 'MMMM d, yyyy')
      );

      // Prepare email content
      const subject = `Your Pain Log Report - ${periodName}`;
      const text = `
        Hello ${userName},

        Attached is your pain log report for ${periodName} (${format(startDate, 'MMMM d, yyyy')} to ${format(endDate, 'MMMM d, yyyy')}).

        Thank you for using PainTracker by PainClinics.com.
      `;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0047AB;">Your Pain Log Report - ${periodName}</h2>
          <p>Hello ${userName},</p>
          <p>Attached is your pain log report for <strong>${periodName}</strong> (${format(startDate, 'MMMM d, yyyy')} to ${format(endDate, 'MMMM d, yyyy')}).</p>
          <p>The report includes a summary of your pain entries during this period, including statistics and detailed entries.</p>
          <p>If you have any questions about your report, please contact your healthcare provider.</p>
          <p>Thank you for using PainTracker by PainClinics.com.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">This is an automated email. Please do not reply to this message.</p>
        </div>
      `;

      // Send email with attachment
      const emailResult = await sendEmailWithAttachment(
        email,
        subject,
        text,
        html,
        pdfBuffer,
        `pain-log-report-${reportId}.pdf`
      );

      if (emailResult.success) {
        res.status(200).json({ 
          message: "Report sent successfully", 
          previewUrl: emailResult.previewUrl 
        });
      } else {
        throw new Error(emailResult.error || "Unknown error sending email");
      }
      
    } catch (error) {
      console.error("Error emailing PDF report:", error);
      res.status(500).send("Error emailing report");
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
