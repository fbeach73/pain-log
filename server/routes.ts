import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertPainEntrySchema, insertMedicationSchema } from "@shared/schema";
import { PainTrendData } from "../client/src/types/pain";
import { format, subDays } from "date-fns";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

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
      
      // Make sure the userId is included in the data to validate
      // Fix the date type issue by parsing string date into a real Date object
      const dataToValidate = {
        ...req.body,
        userId: userId,
        date: req.body.date ? new Date(req.body.date) : new Date() // Convert string to Date object
      };
      
      console.log("Validating pain entry data with userId:", userId, "and date:", dataToValidate.date);
      
      // Custom validation schema that accepts ISO strings for dates
      const customSchema = insertPainEntrySchema.extend({
        date: z.string().transform(val => new Date(val)),
      });
      
      const validatedData = customSchema.parse(dataToValidate);
      console.log("Pain entry data validated successfully, creating entry");
      
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
      
      const validatedData = insertMedicationSchema.parse(req.body);
      const medication = await storage.createMedication(validatedData);
      res.status(201).json(medication);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.message });
      }
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
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const updateData = req.body;
      const updatedProfile = await storage.updateUser(userId, updateData);
      res.json(updatedProfile);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
