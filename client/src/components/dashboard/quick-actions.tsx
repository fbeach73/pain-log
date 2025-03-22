import { useLocation } from "wouter";
import { 
  PlusCircle, 
  FileText, 
  HelpCircle 
} from "lucide-react";

export default function QuickActions() {
  const [, navigate] = useLocation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <button 
        onClick={() => navigate("/log-pain")} 
        className="bg-primary-50 rounded-xl p-5 flex flex-col items-center justify-center transition hover:bg-primary-100"
      >
        <PlusCircle className="h-8 w-8 text-primary mb-2" />
        <span className="text-sm font-medium">Log Pain</span>
      </button>
      
      <button 
        onClick={() => navigate("/reports")} 
        className="bg-primary-50 rounded-xl p-5 flex flex-col items-center justify-center transition hover:bg-primary-100"
      >
        <FileText className="h-8 w-8 text-primary mb-2" />
        <span className="text-sm font-medium">View Report</span>
      </button>
      
      <button 
        onClick={() => navigate("/resources")} 
        className="bg-primary-50 rounded-xl p-5 flex flex-col items-center justify-center transition hover:bg-primary-100"
      >
        <HelpCircle className="h-8 w-8 text-primary mb-2" />
        <span className="text-sm font-medium">Get Help</span>
      </button>
    </div>
  );
}
