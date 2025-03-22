import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

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
  // Set a secure secret or use environment variable
  const sessionSecret = process.env.SESSION_SECRET || "paintrack-session-secret";
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: true, // Changed to true to ensure sessions are saved
    saveUninitialized: false,
    store: storage.sessionStore,
    name: 'paintrack.sid', // Customized cookie name
    rolling: true, // Reset expiration on each request
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for longer sessions
      secure: false, // Set to false during development
      sameSite: "lax",
      httpOnly: true,
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
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      // Login with specific session settings to improve persistence
      req.login(user, { session: true }, (err) => {
        if (err) return next(err);
        
        // Regenerate the session to avoid session fixation attacks
        const oldSession = req.session;
        req.session.regenerate((err) => {
          if (err) return next(err);
          
          // Merge any existing session data
          if (oldSession) {
            Object.assign(req.session, oldSession);
          }
          
          // Set a flag to indicate session is authenticated
          req.session.isAuthenticated = true;
          req.session.loginTime = new Date().toISOString();
          
          // Save the session explicitly
          req.session.save((err) => {
            if (err) return next(err);
            
            // Don't send password to client
            const { password, ...userWithoutPassword } = user;
            console.log("User registered and logged in:", user.username, "- Session ID:", req.sessionID);
            res.status(201).json(userWithoutPassword);
          });
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Login with specific session settings to improve persistence
      req.login(user, { session: true }, (err) => {
        if (err) return next(err);
        
        // Regenerate the session to avoid session fixation attacks
        const oldSession = req.session;
        req.session.regenerate((err) => {
          if (err) return next(err);
          
          // Merge any existing session data
          if (oldSession) {
            Object.assign(req.session, oldSession);
          }
          
          // Set a flag to indicate session is authenticated
          req.session.isAuthenticated = true;
          req.session.loginTime = new Date().toISOString();
          
          // Save the session explicitly
          req.session.save((err) => {
            if (err) return next(err);
            
            // Don't send password to client
            const { password, ...userWithoutPassword } = user;
            console.log("User logged in:", user.username, "- Session ID:", req.sessionID);
            res.status(200).json(userWithoutPassword);
          });
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
    // Check for authenticated session
    if (!req.isAuthenticated()) {
      console.log("GET /api/user - User not authenticated, returning 401");
      return res.sendStatus(401);
    }
    
    // Log session info for debugging
    console.log("GET /api/user - Authenticated session:", {
      id: req.sessionID,
      userId: (req.user as SelectUser).id,
      username: (req.user as SelectUser).username,
      // @ts-ignore
      isAuthenticatedFlag: req.session.isAuthenticated || false,
      // @ts-ignore
      loginTime: req.session.loginTime || 'unknown'
    });
    
    // Don't send password to client
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });
}
