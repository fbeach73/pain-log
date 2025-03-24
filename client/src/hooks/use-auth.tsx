import { createContext, ReactNode, useContext } from "react";
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
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
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

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
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
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1000);
    },
  });

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Function to directly check admin status and create manual session
// This should be used only for explicit user-triggered actions, not automatic logins
export async function checkAdminLogin() {
  try {
    console.log("Auth hook: Checking for admin login...");
    
    // First try the standard /api/user endpoint 
    const userResponse = await fetch('/api/user', {
      credentials: 'include'
    });
    
    if (userResponse.ok) {
      console.log("Auth hook: User already authenticated");
      return { success: true, source: 'user-api' };
    }
    
    // If that fails, try the admin-check endpoint
    const adminCheckResponse = await fetch('/api/admin-check', {
      credentials: 'include'
    });
    
    if (adminCheckResponse.ok) {
      const adminData = await adminCheckResponse.json();
      console.log("Auth hook: Admin check response:", adminData);
      
      if (adminData.success) {
        console.log("Auth hook: Admin user found");
        
        // Force query client to update with admin user data
        queryClient.setQueryData(['/api/user'], adminData.user);
        
        return { success: true, source: 'admin-check', user: adminData.user };
      }
    }
    
    // No more automatic direct login - user must explicitly log in through the UI
    return { success: false, message: "Authentication required" };
  } catch (error) {
    console.error("Auth hook: Error checking admin login:", error);
    return { success: false, error };
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
