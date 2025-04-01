import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

type TriggerStat = {
  name: string;
  frequency: number;
};

export default function CommonTriggers() {
  const [, navigate] = useLocation();
  
  const { data: triggerStats, isLoading } = useQuery<TriggerStat[]>({
    queryKey: ["/api/pain-entries/triggers"],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    retry: 3,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Common Triggers</CardTitle>
          <button 
            onClick={() => navigate("/insights")}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Detailed Analysis
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {triggerStats && triggerStats.length > 0 ? (
              triggerStats.map((trigger) => (
                <div key={trigger.name} className="flex items-center justify-between">
                  <span className="text-sm whitespace-nowrap font-medium mr-2 min-w-[120px]">
                    {trigger.name}
                  </span>
                  <div className="w-full bg-slate-100 rounded-full h-5 relative overflow-hidden">
                    <div 
                      className="bg-primary-600 h-5 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(trigger.frequency, 15)}%` }}
                    >
                      {trigger.frequency >= 20 && (
                        <span className="text-xs text-white font-medium">{trigger.frequency}%</span>
                      )}
                    </div>
                    {trigger.frequency < 20 && (
                      <span className="text-xs text-primary-700 font-medium absolute right-2 top-1/2 transform -translate-y-1/2">
                        {trigger.frequency}%
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-4">
                No triggers identified yet. Continue logging your pain.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
