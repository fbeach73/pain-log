import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import fs from "fs";
import path from "path";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

// Extend the session type to include our custom properties
declare module 'express-session' {
  interface SessionData {
    loggedIn?: boolean;
    loginTime?: string;
    adminId?: number;
    passport?: {
      user?: number; // User ID stored by passport
    };
  }
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Set a consistent secret - don't change this on redeployments or users will lose sessions
  const sessionSecret = process.env.SESSION_SECRET || "paintrack-persistent-session-secret-7ad3";
  
  // Determine if we're in production or development
  const isProd = process.env.NODE_ENV === 'production';
  console.log(`Setting up auth in ${isProd ? 'production' : 'development'} mode`);

  // Initialize session store based on environment
  let sessionStore;
  
  // Check if we have a database connection for PostgreSQL session store
  if (pool) {
    console.log("Using PostgreSQL session store for persistent sessions");
    
    // Initialize connect-pg-simple
    const PgSessionStore = connectPgSimple(session);
    sessionStore = new PgSessionStore({
      pool, // Pass the PostgreSQL pool
      tableName: 'session', // Table name to use for sessions
      createTableIfMissing: true, // Create the table if it doesn't exist
      pruneSessionInterval: 60 * 60, // Prune expired sessions every hour (in seconds)
      errorLog: console.error // Log any errors to the console
    });
  } else {
    // Fallback to memory store if no database connection
    console.log("WARNING: Falling back to memory session store - sessions will not persist across server restarts!");
    const MemoryStore = createMemoryStore(session);
    sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Prune expired entries every 24h (1 day in ms)
    });
  }
  
  // Use dedicated PostgreSQL store for sessions when available
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    store: sessionStore, // Use our PostgreSQL store or fallback to memory store
    name: 'paintrack.sid', // Customized cookie name
    rolling: true, // Reset expiration on each request
    proxy: true, // Trust the reverse proxy
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days to reduce stale sessions
      secure: false, // MUST be false for cookies to work in Replit
      sameSite: "lax", // Standard cookie same-site policy
      httpOnly: true, // Set to true for security
      domain: undefined, // Let the browser determine the domain
      path: '/'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport to use local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Normal authentication flow
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  // Serialization and deserialization
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      // Normal user
      // Check if id is a valid number that could be a user ID
      if (!id || id === 999 || isNaN(id) || id <= 0) {
        console.log(`Deserialize skipped - invalid user ID ${id}`);
        return done(null, false);
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        console.log(`Deserialize failed - no user found with ID ${id}`);
        // Return false instead of error to prevent application crashes
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      // Return false instead of error to prevent application crashes
      done(null, false);
    }
  });

  // Authentication routes
  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registration attempt for username:", req.body.username);
      
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log("Registration failed: Username already exists:", req.body.username);
        return res.status(400).json({ message: "Username already exists" });
      }

      console.log("Creating new user...");
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });
      console.log("User created successfully:", user.username);

      // Simple login without session regeneration which was causing issues
      req.login(user, (err) => {
        if (err) {
          console.error("Session login error during registration:", err);
          return next(err);
        }
        
        console.log("User logged in to session after registration, saving session...");
        
        // Save session explicitly
        req.session.save((err) => {
          if (err) {
            console.error("Session save error during registration:", err);
            return next(err);
          }
          
          // Debug session data
          console.log("Session saved successfully after registration:", {
            id: req.sessionID,
            cookie: req.session.cookie,
          });
          
          // Don't send password to client
          const { password, ...userWithoutPassword } = user;
          console.log("Registration and login successful for:", user.username, "- Session ID:", req.sessionID);
          res.status(201).json(userWithoutPassword);
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Login attempt for username:", req.body.username);
    
    passport.authenticate("local", (err: Error | null, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("Login failed: Invalid credentials for", req.body.username);
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      console.log("Credentials valid for user:", user.username);
      
      // Log the session before login
      console.log("Session before login:", {
        id: req.sessionID,
        cookie: req.session?.cookie
      });
      
      // Set a flag in the session to help troubleshoot
      req.session.loggedIn = true;
      req.session.loginTime = new Date().toISOString();
      
      // Login the user
      req.login(user, (err) => {
        if (err) {
          console.error("Session login error:", err);
          return next(err);
        }
        
        console.log("User logged in to session, saving session...");
        
        // Save session explicitly and ensure it persists
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return next(err);
          }
          
          // Debug session data
          console.log("Session saved successfully:", {
            id: req.sessionID,
            loggedIn: req.session.loggedIn,
            loginTime: req.session.loginTime,
            cookie: req.session.cookie,
            user: user.id
          });
          
          // Don't send password to client
          const { password, ...userWithoutPassword } = user;
          console.log("Login successful for:", user.username, "- Session ID:", req.sessionID);
          res.status(200).json(userWithoutPassword);
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    try {
      // Check if the request is authenticated with valid session
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      // Check if user object exists in the request
      if (!req.user) {
        console.log("User endpoint: authenticated but no user object found");
        return res.sendStatus(401);
      }
      
      // Log successful user data fetch
      console.log(`User data fetched for user ID: ${req.user.id}`);
      
      // Don't send password to client
      const { password, ...userWithoutPassword } = req.user as SelectUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error in /api/user endpoint:", error);
      res.status(500).json({ message: "Server error fetching user data" });
    }
  });
}
