import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bolt, Play } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

type Recommendation = {
  id: string;
  title: string;
  description: string;
  type: "exercise" | "tip";
  resourceLink: string;
};

export default function Recommendations() {
  const [, navigate] = useLocation();
  
  const { data: recommendations, isLoading } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations"],
  });

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Personalized Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommendations && recommendations.length > 0 ? (
              recommendations.map((recommendation) => (
                <div 
                  key={recommendation.id} 
                  className="bg-slate-50 rounded-lg p-4 border border-slate-100"
                >
                  <div className="flex mb-3">
                    {recommendation.type === "exercise" ? (
                      <Play className="h-6 w-6 text-primary mr-2" />
                    ) : (
                      <Bolt className="h-6 w-6 text-primary mr-2" />
                    )}
                    <h4 className="font-medium">{recommendation.title}</h4>
                  </div>
                  <p className="text-sm text-slate-600">{recommendation.description}</p>
                  <button 
                    onClick={() => navigate(recommendation.resourceLink)}
                    className="text-sm text-primary-600 hover:text-primary-700 mt-2 inline-block"
                  >
                    {recommendation.type === "exercise" ? "View exercises" : "Learn more"}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-4 col-span-2">
                Continue logging your pain to receive personalized recommendations.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
