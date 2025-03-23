import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

// Extend the session type to include our custom properties
declare module 'express-session' {
  interface SessionData {
    loggedIn?: boolean;
    loginTime?: string;
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

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false, // Only save session when modified
    saveUninitialized: false, // Don't create session until something stored
    store: storage.sessionStore,
    name: 'paintrack.sid', // Customized cookie name
    rolling: true, // Reset expiration on each request
    proxy: true, // Trust the reverse proxy
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for longer sessions
      secure: isProd, // Secure in production, not in development
      sameSite: "lax", // Standard cookie same-site policy
      httpOnly: true, // The cookie cannot be accessed via JavaScript
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
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
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

  app.get("/api/user", async (req, res) => {
    // Debug session information
    console.log("GET /api/user - Request received:", {
      isAuthenticated: req.isAuthenticated(),
      hasUserObject: !!req.user,
      sessionID: req.sessionID,
      sessionCookie: req.session?.cookie,
      loggedIn: req.session?.loggedIn,
      loginTime: req.session?.loginTime,
      user: req.user ? `${(req.user as any).username} (ID: ${(req.user as any).id})` : "not available"
    });

    // Check for authenticated session
    if (!req.isAuthenticated() || !req.user) {
      // Additional debugging - check if session exists but user isn't loaded properly
      if (req.session?.loggedIn) {
        console.log("GET /api/user - Session exists but user not authenticated properly");
        
        // Try to recover the user from the session if possible
        if (req.session.passport?.user) {
          const userId = req.session.passport.user;
          console.log(`GET /api/user - Attempting to recover user ID ${userId} from session`);
          
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
      }
      
      console.log("GET /api/user - User not authenticated, returning 401");
      return res.sendStatus(401);
    }
    
    // Log session info for debugging
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
}
