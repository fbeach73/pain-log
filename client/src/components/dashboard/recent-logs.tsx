import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PainEntry } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useLocation } from "wouter";

export default function RecentLogs() {
  const [, navigate] = useLocation();
  
  const { data: recentLogs, isLoading } = useQuery<PainEntry[]>({
    queryKey: ["/api/pain-entries/recent"],
  });
  
  const getBadgeColor = (intensity: number) => {
    if (intensity <= 3) return "bg-green-100 text-green-800";
    if (intensity <= 6) return "bg-yellow-100 text-yellow-800";
    if (intensity <= 8) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };
  
  const formatDate = (date: Date | string) => {
    const now = new Date();
    const logDate = new Date(date);
    
    if (logDate.toDateString() === now.toDateString()) {
      return `Today, ${format(logDate, "h:mm a")}`;
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (logDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${format(logDate, "h:mm a")}`;
    }
    
    return format(logDate, "MMM d, h:mm a");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Recent Logs</CardTitle>
          <button 
            onClick={() => navigate("/insights")}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            View All
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {recentLogs && recentLogs.length > 0 ? (
              recentLogs.map((log, index) => (
                <div 
                  key={log.id} 
                  className={`${
                    index < recentLogs.length - 1 ? "border-b border-slate-100 pb-3" : "pb-1"
                  }`}
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">
                      {formatDate(log.date)}
                    </span>
                    <span className={`px-2 py-1 ${getBadgeColor(log.intensity)} rounded-full text-xs font-medium`}>
                      {log.intensity}/10
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {log.notes || `Pain in ${(log.locations as string[]).join(", ")}`}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-4">
                No pain logs yet. Start tracking your pain!
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
