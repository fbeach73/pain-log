import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";

type NavItem = {
  path: string;
  label: string;
};

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard" },
  { path: "/log-pain", label: "Log Pain" },
  { path: "/insights", label: "Insights" },
  { path: "/resources", label: "Resources" },
  { path: "/reports", label: "Reports" },
  { path: "/profile", label: "Profile" },
];

export default function NavigationTabs() {
  const [location, navigate] = useLocation();
  const { user, refetchUser } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);

  // Verify authentication before navigation
  const handleNavigation = async (path: string) => {
    if (path === location) return; // No need to navigate if already on this path
    
    setIsVerifying(true);
    
    try {
      // Verify user is still authenticated before navigation
      if (refetchUser) {
        console.log("NavigationTabs: Verifying authentication before navigating to", path);
        const result = await refetchUser();
        const isAuthenticated = !!result.data;
        
        if (!isAuthenticated) {
          console.log("NavigationTabs: Not authenticated, redirecting to /auth");
          navigate("/auth");
          return;
        }
      } else if (!user) {
        // If refetchUser is not available but we know user is null, redirect to auth
        console.log("NavigationTabs: No user data available, redirecting to /auth");
        navigate("/auth");
        return;
      }
      
      // If we're here, authentication is good - navigate to the requested path
      navigate(path);
    } catch (error) {
      console.error("NavigationTabs: Error verifying authentication:", error);
      navigate("/auth");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-white border-b">
      <div className="px-4 sm:px-6 md:px-8">
        <nav className="flex -mb-px space-x-4 md:space-x-6 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              disabled={isVerifying}
              className={cn(
                "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex-shrink-0",
                location === item.path
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
