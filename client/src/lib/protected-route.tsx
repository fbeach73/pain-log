import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading, refetchUser } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Effect to verify authentication status when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const verifyAuth = async () => {
      if (!refetchUser) {
        if (isMounted) {
          setIsAuthenticated(!!user);
          setIsVerifying(false);
        }
        return;
      }
      
      try {
        console.log("Protected route: Verifying authentication...");
        const result = await refetchUser();
        const authenticated = !!result.data;
        
        console.log("Protected route: Authentication verified:", authenticated);
        
        if (isMounted) {
          setIsAuthenticated(authenticated);
          setIsVerifying(false);
        }
      } catch (error) {
        console.error("Protected route: Failed to verify authentication:", error);
        
        if (isMounted) {
          setIsAuthenticated(false);
          setIsVerifying(false);
        }
      }
    };

    verifyAuth();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [refetchUser, user, path]);

  // Show loading state while we verify auth or while the original loading is happening
  if (isLoading || isVerifying) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log("Protected route: Not authenticated, redirecting to /auth");
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // User is authenticated, render the component
  return <Route path={path} component={Component} />;
}
