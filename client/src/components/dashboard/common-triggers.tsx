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
                <div key={trigger.name} className="flex items-center">
                  <div className="w-full bg-slate-100 rounded-full h-4 mr-2">
                    <div 
                      className="bg-primary-500 h-4 rounded-full" 
                      style={{ width: `${trigger.frequency}%` }}
                    />
                  </div>
                  <span className="text-sm whitespace-nowrap font-medium">
                    {trigger.name}
                  </span>
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
