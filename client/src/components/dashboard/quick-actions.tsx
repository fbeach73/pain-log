import { useLocation } from "wouter";
import { 
  PlusCircle, 
  FileText, 
  HelpCircle,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export default function QuickActions() {
  const [, navigate] = useLocation();
  const { user, refetchUser } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Verify authentication before navigation
  const handleNavigation = async (path: string, actionName: string) => {
    setIsVerifying(true);
    setLoadingAction(actionName);
    
    try {
      // Verify user is still authenticated before navigation
      if (refetchUser) {
        console.log("QuickActions: Verifying authentication before navigating to", path);
        const result = await refetchUser();
        const isAuthenticated = !!result.data;
        
        if (!isAuthenticated) {
          console.log("QuickActions: Not authenticated, redirecting to /auth");
          navigate("/auth");
          return;
        }
      } else if (!user) {
        // If refetchUser is not available but we know user is null, redirect to auth
        console.log("QuickActions: No user data available, redirecting to /auth");
        navigate("/auth");
        return;
      }
      
      // If we're here, authentication is good - navigate to the requested path
      navigate(path);
    } catch (error) {
      console.error("QuickActions: Error verifying authentication:", error);
      navigate("/auth");
    } finally {
      setIsVerifying(false);
      setLoadingAction(null);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <button 
        onClick={() => handleNavigation("/log-pain", "log-pain")} 
        disabled={isVerifying}
        className="bg-primary-50 rounded-xl p-5 flex flex-col items-center justify-center transition hover:bg-primary-100 relative"
      >
        {loadingAction === "log-pain" ? (
          <Loader2 className="h-8 w-8 text-primary mb-2 animate-spin" />
        ) : (
          <PlusCircle className="h-8 w-8 text-primary mb-2" />
        )}
        <span className="text-sm font-medium">Log Pain</span>
      </button>
      
      <button 
        onClick={() => handleNavigation("/reports", "reports")} 
        disabled={isVerifying}
        className="bg-primary-50 rounded-xl p-5 flex flex-col items-center justify-center transition hover:bg-primary-100 relative"
      >
        {loadingAction === "reports" ? (
          <Loader2 className="h-8 w-8 text-primary mb-2 animate-spin" />
        ) : (
          <FileText className="h-8 w-8 text-primary mb-2" />
        )}
        <span className="text-sm font-medium">View Report</span>
      </button>
      
      <button 
        onClick={() => handleNavigation("/resources", "resources")} 
        disabled={isVerifying}
        className="bg-primary-50 rounded-xl p-5 flex flex-col items-center justify-center transition hover:bg-primary-100 relative"
      >
        {loadingAction === "resources" ? (
          <Loader2 className="h-8 w-8 text-primary mb-2 animate-spin" />
        ) : (
          <HelpCircle className="h-8 w-8 text-primary mb-2" />
        )}
        <span className="text-sm font-medium">Get Help</span>
      </button>
    </div>
  );
}
