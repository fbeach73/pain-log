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
      pruneSessionInterval: 60 * 60 // Prune expired sessions every hour (in seconds)
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
    resave: true, // Save session on every request to ensure it persists
    saveUninitialized: true, // Create session before anything is stored (for better compatibility)
    store: sessionStore, // Use our PostgreSQL store or fallback to memory store
    name: 'paintrack.sid', // Customized cookie name
    rolling: true, // Reset expiration on each request
    proxy: true, // Trust the reverse proxy
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for longer sessions
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
        // Special case for testing
        if (username === "admin" && password === "admin123") {
          console.log("Using hardcoded admin credentials for testing");
          // Create a temporary admin user with all required fields
          const adminUser: SelectUser = {
            id: 999,
            username: "admin",
            password: "hashed-password-not-used",
            firstName: "Admin",
            lastName: "User",
            email: "admin@example.com",
            profileCreated: true,
            medicalHistory: [],
            painBackground: null,
            age: 30,
            gender: "Not specified",
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
          return done(null, adminUser);
        }
        
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
      // Special case for our hardcoded admin user
      if (id === 999) {
        console.log("Deserializing admin user");
        const adminUser: SelectUser = {
          id: 999,
          username: "admin",
          password: "hashed-password-not-used",
          firstName: "Admin",
          lastName: "User",
          email: "admin@example.com",
          profileCreated: true,
          medicalHistory: [],
          painBackground: null,
          age: 30,
          gender: "Not specified",
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
        return done(null, adminUser);
      }
      
      // Normal user
      const user = await storage.getUser(id);
      if (!user) {
        console.log(`Deserialize failed - no user found with ID ${id}`);
        return done(new Error(`No user found with ID ${id}`));
      }
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      done(error);
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

  // Special backdoor login for testing
  app.get("/api/backdoor-login", (req, res, next) => {
    console.log("Backdoor login accessed", {
      hasSession: !!req.session,
      sessionID: req.sessionID,
      cookies: req.headers.cookie
    });
    
    // Create temporary admin user
    const adminUser: SelectUser = {
      id: 999,
      username: "admin",
      password: "hashed-password-not-used",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      profileCreated: true,
      medicalHistory: [],
      painBackground: null,
      age: 30,
      gender: "Not specified",
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
    
    // Set a series of debug cookies to test if cookies work at all
    // Use different domains, paths and security settings to see what works
    res.cookie('debug_cookie', 'test-value-1', { 
      maxAge: 3600000, 
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/'
    });
    
    res.cookie('debug_secure_cookie', 'test-value-2', { 
      maxAge: 3600000, 
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      path: '/'
    });
    
    res.cookie('debug_http_cookie', 'test-value-3', { 
      maxAge: 3600000, 
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/'
    });
    
    // Clean any existing data - we'll regenerate the session for a fresh start
    req.session.regenerate((err) => {
      if (err) {
        console.error("Backdoor session regeneration error:", err);
        return next(err);
      }
      
      console.log("Session regenerated with new session ID:", req.sessionID);
      
      // Login with admin user on the fresh session
      req.login(adminUser, (err) => {
        if (err) {
          console.error("Backdoor login error:", err);
          return next(err);
        }
        
        // Set session flags
        req.session.loggedIn = true;
        req.session.loginTime = new Date().toISOString();
        req.session.adminId = 999;
        
        // Make absolutely sure passport data is properly set
        if (!req.session.passport) {
          req.session.passport = { user: 999 };
          console.log("Manual passport data set in session");
        }
        
        // Save session explicitly
        req.session.save((err) => {
          if (err) {
            console.error("Backdoor session save error:", err);
            return next(err);
          }
          
          console.log("Backdoor login successful, session saved:", {
            id: req.sessionID,
            loggedIn: req.session.loggedIn,
            adminId: req.session.adminId,
            passport: req.session.passport,
            cookie: req.session.cookie,
            user: req.user ? `${(req.user as any).username} (ID: ${(req.user as any).id})` : "not available"
          });
          
          // Test if user is available through req.user
          if (req.isAuthenticated()) {
            console.log("Backdoor login: Authentication successful, user is available");
          } else {
            console.log("Backdoor login: Warning - user authenticated but req.isAuthenticated() returns false");
          }
          
          // Return both HTML and data in the response for easier debugging
          res.send(`
            <html>
              <head>
                <title>Login Successful</title>
                <script>
                  // Store debug info in sessionStorage
                  sessionStorage.setItem('backdoorLoginTime', '${new Date().toISOString()}');
                  sessionStorage.setItem('backdoorSessionId', '${req.sessionID}');
                  
                  // Log cookies
                  console.log('Cookies after login:', document.cookie);
                  
                  // Create local storage markers to help with session debugging
                  localStorage.setItem('paintrack_debug_session', '${req.sessionID}');
                  localStorage.setItem('paintrack_debug_time', '${new Date().toISOString()}');
                  
                  // Create a simple cookie directly in the browser to test
                  document.cookie = 'browser_test_cookie=simple-test-value; path=/; max-age=3600';
                  
                  // Add a visual indicator for developers
                  const debugBanner = document.createElement('div');
                  debugBanner.style.position = 'fixed';
                  debugBanner.style.bottom = '10px';
                  debugBanner.style.right = '10px';
                  debugBanner.style.padding = '5px 10px';
                  debugBanner.style.backgroundColor = 'rgba(0,0,0,0.7)';
                  debugBanner.style.color = 'white';
                  debugBanner.style.fontSize = '12px';
                  debugBanner.style.borderRadius = '3px';
                  debugBanner.textContent = 'Admin Session: ' + '${req.sessionID.substring(0, 8)}...';
                  document.body.appendChild(debugBanner);
                  
                  // Redirect after a short delay to allow the session to be established
                  setTimeout(() => {
                    window.location.href = "/";
                  }, 1500);
                </script>
              </head>
              <body>
                <h1>Login Successful</h1>
                <p><strong>Session ID:</strong> ${req.sessionID}</p>
                <p><strong>Debug cookies set:</strong> debug_cookie, debug_secure_cookie, debug_http_cookie</p>
                <p><strong>Browser storage:</strong> Session ID saved to localStorage and sessionStorage</p>
                <p>You will be redirected to the dashboard in 1.5 seconds...</p>
                <p>If you are not redirected, <a href="/">click here</a></p>
                <hr>
                <details>
                  <summary>Session Debug Info</summary>
                  <pre>${JSON.stringify({
                    id: req.sessionID,
                    cookie: req.session.cookie,
                    passport: req.session.passport || 'Not set',
                    user: req.user ? { id: (req.user as any).id, username: (req.user as any).username } : 'Not available'
                  }, null, 2)}</pre>
                </details>
              </body>
            </html>
          `);
        });
      });
    });
  });

  app.get("/api/user", async (req, res) => {
    // Debug session information
    console.log("GET /api/user - Request received:", {
      isAuthenticated: req.isAuthenticated(),
      hasUserObject: !!req.user,
      sessionID: req.sessionID,
      sessionCookie: req.session?.cookie,
      loggedIn: req.session?.loggedIn,
      loginTime: req.session?.loginTime,
      adminId: req.session?.adminId,
      passportUser: req.session?.passport?.user,
      user: req.user ? `${(req.user as any).username} (ID: ${(req.user as any).id})` : "not available"
    });

    // Check for authenticated session via multiple methods
    if (!req.isAuthenticated() || !req.user) {
      // First recovery method - Check if the admin shortcut is available
      if (req.session?.adminId === 999) {
        console.log("GET /api/user - Admin shortcut found in session");
        
        // Create admin user for special case
        const adminUser: SelectUser = {
          id: 999,
          username: "admin",
          password: "hashed-password-not-used", // Not sent to client
          firstName: "Admin",
          lastName: "User",
          email: "admin@example.com",
          profileCreated: true,
          medicalHistory: [],
          painBackground: null,
          age: 30,
          gender: "Not specified",
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
        
        // Login the user to passport to fix the session
        req.login(adminUser, (err) => {
          if (err) {
            console.error("GET /api/user - Error logging in admin user:", err);
            return res.sendStatus(500);
          }
          
          // Fix session data if needed
          if (!req.session.passport) {
            req.session.passport = { user: 999 };
          }
          
          // Save fixed session
          req.session.save((err) => {
            if (err) {
              console.error("GET /api/user - Error saving fixed admin session:", err);
            }
            
            // Return admin user without password
            const { password, ...userWithoutPassword } = adminUser;
            console.log("GET /api/user - Successfully recovered admin user via adminId");
            return res.json(userWithoutPassword);
          });
        });
        return; // Return here to avoid sending multiple responses
      }
      
      // Second recovery method - check for passport user ID
      else if (req.session?.passport?.user) {
        const userId = req.session.passport.user;
        console.log(`GET /api/user - Attempting to recover user ID ${userId} from session passport data`);
        
        // Special case for admin ID
        if (userId === 999) {
          console.log("GET /api/user - Admin passport user found, creating admin account");
          
          // Create admin user for special case
          const adminUser = {
            id: 999,
            username: "admin",
            firstName: "Admin",
            lastName: "User",
            email: "admin@example.com",
            profileCreated: true,
            medicalHistory: [],
            painBackground: null,
            age: 30,
            gender: "Not specified",
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
          
          console.log("GET /api/user - Successfully recovered admin user via passport user ID");
          return res.json(adminUser);
        }
        
        // Standard user recovery
        try {
          const user = await storage.getUser(userId);
          if (user) {
            console.log(`GET /api/user - Successfully recovered user ${user.username} (ID: ${user.id})`);
            // Don't send password to client
            const { password, ...userWithoutPassword } = user;
            return res.json(userWithoutPassword);
          }
        } catch (error) {
          console.error("GET /api/user - Error recovering user:", error);
        }
      }
      
      // Third recovery method - check session flags
      else if (req.session?.loggedIn) {
        console.log("GET /api/user - Session marked as logged in but no user data available");
        
        // Check if there's a loginTime (debug data)
        if (req.session.loginTime) {
          console.log(`GET /api/user - Session login timestamp: ${req.session.loginTime}`);
        }
        
        // No recovery method worked
        console.log("GET /api/user - No user data available to recover");
      }
      
      // No session or recovery failed
      console.log("GET /api/user - User not authenticated, returning 401");
      return res.sendStatus(401);
    }
    
    // Log session info for authenticated session
    console.log("GET /api/user - Authenticated session:", {
      id: req.sessionID,
      userId: (req.user as SelectUser).id,
      username: (req.user as SelectUser).username,
      cookieMaxAge: req.session.cookie.maxAge,
      cookieExpires: req.session.cookie.expires
    });
    
    // Don't send password to client
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });
  
  // Special route to test if we can get admin user directly
  app.get("/api/admin-check", (req, res) => {
    console.log("Admin check accessed", {
      hasSession: !!req.session,
      sessionID: req.sessionID,
      cookies: req.headers.cookie,
      adminId: req.session?.adminId
    });
    
    // Return admin info regardless of authentication status
    if (req.session?.adminId === 999) {
      console.log("Admin check: found admin ID in session");
      
      // Create admin user data manually
      const adminUser = {
        id: 999,
        username: "admin",
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        profileCreated: true
      };
      
      return res.json({ 
        success: true, 
        user: adminUser,
        message: "Admin user found via session adminId"
      });
    }
    
    // Check if authenticated as admin
    if (req.isAuthenticated() && req.user && (req.user as any).id === 999) {
      console.log("Admin check: User is authenticated as admin");
      
      const { password, ...userWithoutPassword } = req.user as SelectUser;
      return res.json({ 
        success: true, 
        user: userWithoutPassword,
        message: "User authenticated as admin"
      });
    }
    
    // Final fallback for session.passport.user
    if (req.session?.passport?.user === 999) {
      console.log("Admin check: Found admin ID in passport session");
      
      // Create admin user data manually
      const adminUser = {
        id: 999,
        username: "admin",
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        profileCreated: true
      };
      
      return res.json({ 
        success: true, 
        user: adminUser,
        message: "Admin user found via passport.user"
      });
    }
    
    // No admin user found
    console.log("Admin check: No admin user found in session");
    res.json({ 
      success: false, 
      message: "No admin user found in session"
    });
  });
}
