import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PainTrendData } from "@/types/pain";
import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

type PeriodOption = "7days" | "30days" | "90days";

export default function PainTrendChart() {
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState<PeriodOption>("7days");
  
  const { data: painData, isLoading } = useQuery<PainTrendData[]>({
    queryKey: ["/api/pain-entries/trend", period],
  });
  
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  const calculateAverage = (data?: PainTrendData[]): number => {
    if (!data || data.length === 0) return 0;
    const sum = data.reduce((acc, item) => acc + item.intensity, 0);
    return parseFloat((sum / data.length).toFixed(1));
  };
  
  const average = calculateAverage(painData);
  
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Pain Trends</h3>
          <div className="flex space-x-2">
            <Button 
              variant={period === "7days" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setPeriod("7days")} 
              className="text-xs rounded-full"
            >
              7 Days
            </Button>
            <Button 
              variant={period === "30days" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setPeriod("30days")} 
              className="text-xs rounded-full"
            >
              30 Days
            </Button>
            <Button 
              variant={period === "90days" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setPeriod("90days")} 
              className="text-xs rounded-full"
            >
              90 Days
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
          </div>
        ) : (
          <div className="relative" style={{ height: "200px" }}>
            <div className="absolute inset-0 flex items-end">
              {days.map((day, index) => (
                <div key={day} className="flex-1 flex flex-col items-center">
                  <div 
                    className={`w-3/4 ${index > 4 ? 'bg-secondary-500' : 'bg-primary-500'} rounded-t`} 
                    style={{ height: `${(painData?.[index]?.intensity || 0) * 10}%` }}
                  ></div>
                  <span className="text-xs text-slate-500 mt-2">{day}</span>
                </div>
              ))}
            </div>
            
            {/* Y-axis labels */}
            <div className="absolute left-0 inset-y-0 flex flex-col justify-between text-xs text-slate-500 pr-2">
              <span>10</span>
              <span>8</span>
              <span>6</span>
              <span>4</span>
              <span>2</span>
              <span>0</span>
            </div>
          </div>
        )}
        
        <div className="mt-4 flex justify-between items-center text-sm">
          <div className="text-slate-600">
            <span className="font-medium">Average:</span> 
            <span className="text-primary-700 font-semibold">{average}/10</span>
          </div>
          <Button 
            variant="link" 
            onClick={() => navigate("/insights")} 
            className="text-primary-600 font-medium hover:text-primary-700 p-0 h-auto"
          >
            Detailed Analysis
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
