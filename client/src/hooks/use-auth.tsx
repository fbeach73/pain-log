import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  refetchUser?: () => Promise<any>;
  storedUserInfo: Partial<SelectUser> | null;
  attemptAutoLogin: (storedInfo: Partial<SelectUser>) => Promise<SelectUser | null>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Save last successful user info in localStorage
  const saveUserInfo = (user: SelectUser) => {
    try {
      // Only store non-sensitive information
      const userInfo = {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      };
      localStorage.setItem('painTracker_userInfo', JSON.stringify(userInfo));
    } catch (e) {
      console.error('Error saving user info to localStorage:', e);
    }
  };
  
  // Get stored user info
  const getStoredUserInfo = (): Partial<SelectUser> | null => {
    try {
      const storedData = localStorage.getItem('painTracker_userInfo');
      return storedData ? JSON.parse(storedData) : null;
    } catch (e) {
      console.error('Error retrieving user info from localStorage:', e);
      return null;
    }
  };
  
  // User data query
  const {
    data: user,
    error,
    isLoading,
    refetch: refetchUser,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true,
    retry: 2, // More retries for user data
    refetchOnReconnect: true
  });
  
  // If user data changes and is valid, save it
  useEffect(() => {
    if (user) {
      saveUserInfo(user);
    }
  }, [user]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      saveUserInfo(user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.firstName || user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registration successful",
        description: "Your account has been created successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      console.log("Logout successful, redirecting to /auth");
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      localStorage.removeItem('painTracker_userInfo'); // Clear stored user info
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      // Force redirect to auth page
      setTimeout(() => {
        window.location.href = "/auth";
      }, 500); // Short delay to allow toast to be shown
    },
    onError: (error: Error) => {
      console.error("Logout failed:", error);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
      // Even if server logout fails, clear local user data and redirect
      queryClient.setQueryData(["/api/user"], null);
      localStorage.removeItem('painTracker_userInfo'); // Clear stored user info
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1000);
    },
  });
  
  // Auto-login attempt using stored credentials on app reload or session loss
  const attemptAutoLogin = async (storedInfo: Partial<SelectUser>) => {
    if (!storedInfo || !storedInfo.username) return null;
    
    try {
      // First try to see if current session is still valid by refetching
      const result = await refetchUser?.();
      if (result?.data) {
        // Server session is still valid, no need for manual auto-login
        console.log("Session active, no auto-login needed");
        return result.data;
      }
      
      // Session lost but we have stored user info, show a message
      toast({
        title: "Session Expired",
        description: "You'll need to log in again to continue.",
        variant: "default",
      });
      
      return null;
    } catch (error) {
      console.error("Auto-login attempt failed:", error);
      return null;
    }
  };
  
  // Effect to attempt auto-login when session is lost but we have stored user info
  useEffect(() => {
    // Only attempt if we're not currently loading, have no user, and auth isn't currently in progress
    if (!isLoading && !user && !loginMutation.isPending && !registerMutation.isPending) {
      const storedInfo = getStoredUserInfo();
      if (storedInfo && storedInfo.username) {
        console.log("Attempting session recovery for:", storedInfo.username);
        attemptAutoLogin(storedInfo);
      }
    }
  }, [isLoading, user]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        refetchUser,
        storedUserInfo: getStoredUserInfo(),
        attemptAutoLogin, // Expose this to allow components to trigger it explicitly
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}



export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
