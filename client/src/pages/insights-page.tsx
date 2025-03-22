import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import NavigationTabs from "@/components/layout/navigation-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PainEntry } from "@shared/schema";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

type PatternData = {
  title: string;
  description: string;
  confidence: number;
  source: string;
};

export default function InsightsPage() {
  const { data: painEntries, isLoading: entriesLoading } = useQuery<PainEntry[]>({
    queryKey: ["/api/pain-entries"],
  });
  
  const { data: patterns, isLoading: patternsLoading } = useQuery<PatternData[]>({
    queryKey: ["/api/pain-entries/patterns"],
  });
  
  const getBadgeColor = (intensity: number) => {
    if (intensity <= 3) return "bg-green-100 text-green-800";
    if (intensity <= 6) return "bg-yellow-100 text-yellow-800";
    if (intensity <= 8) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <NavigationTabs />
      
      <main className="flex-1 bg-slate-50">
        <div className="container max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Pain Insights</h1>
          
          <Tabs defaultValue="analysis">
            <TabsList className="mb-6">
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="patterns">Patterns</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analysis">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Pain Intensity Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {entriesLoading ? (
                      <Skeleton className="h-64 w-full" />
                    ) : (
                      <div className="h-64 flex items-center justify-center border border-dashed border-slate-300 rounded-md">
                        <p className="text-slate-500">Pain trend chart will be displayed here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Pain by Location</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {entriesLoading ? (
                      <Skeleton className="h-64 w-full" />
                    ) : (
                      <div className="h-64 flex items-center justify-center border border-dashed border-slate-300 rounded-md">
                        <p className="text-slate-500">Pain location chart will be displayed here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Common Triggers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {entriesLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <div className="w-full bg-slate-100 rounded-full h-4 mr-2">
                            <div className="bg-primary-500 h-4 rounded-full" style={{ width: "75%" }}></div>
                          </div>
                          <span className="text-sm whitespace-nowrap font-medium">Poor Sleep</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-full bg-slate-100 rounded-full h-4 mr-2">
                            <div className="bg-primary-500 h-4 rounded-full" style={{ width: "60%" }}></div>
                          </div>
                          <span className="text-sm whitespace-nowrap font-medium">Stress</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-full bg-slate-100 rounded-full h-4 mr-2">
                            <div className="bg-primary-500 h-4 rounded-full" style={{ width: "45%" }}></div>
                          </div>
                          <span className="text-sm whitespace-nowrap font-medium">Physical Activity</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Pain by Time of Day</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {entriesLoading ? (
                      <Skeleton className="h-40 w-full" />
                    ) : (
                      <div className="h-40 flex items-center justify-center border border-dashed border-slate-300 rounded-md">
                        <p className="text-slate-500">Time of day chart will be displayed here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Pain Characteristics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {entriesLoading ? (
                      <Skeleton className="h-40 w-full" />
                    ) : (
                      <div className="h-40 flex items-center justify-center border border-dashed border-slate-300 rounded-md">
                        <p className="text-slate-500">Characteristics chart will be displayed here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Pain Log History</CardTitle>
                </CardHeader>
                <CardContent>
                  {entriesLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {painEntries && painEntries.length > 0 ? (
                        painEntries.map((entry) => (
                          <div key={entry.id} className="border border-slate-200 rounded-lg p-4">
                            <div className="flex justify-between mb-2">
                              <span className="font-medium">{format(new Date(entry.date), "MMM d, yyyy h:mm a")}</span>
                              <span className={`px-2 py-1 ${getBadgeColor(entry.intensity)} rounded-full text-xs font-medium`}>
                                {entry.intensity}/10
                              </span>
                            </div>
                            <div className="mb-2">
                              <span className="text-sm text-slate-500 mr-2">Locations:</span>
                              <span className="text-sm">{(entry.locations as string[]).join(", ")}</span>
                            </div>
                            {entry.characteristics && (entry.characteristics as string[]).length > 0 && (
                              <div className="mb-2">
                                <span className="text-sm text-slate-500 mr-2">Characteristics:</span>
                                <span className="text-sm">{(entry.characteristics as string[]).join(", ")}</span>
                              </div>
                            )}
                            {entry.triggers && (entry.triggers as string[]).length > 0 && (
                              <div className="mb-2">
                                <span className="text-sm text-slate-500 mr-2">Triggers:</span>
                                <span className="text-sm">{(entry.triggers as string[]).join(", ")}</span>
                              </div>
                            )}
                            {entry.notes && (
                              <div className="mt-2 text-sm">{entry.notes}</div>
                            )}
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
            </TabsContent>
            
            <TabsContent value="patterns">
              <Card>
                <CardHeader>
                  <CardTitle>Identified Patterns</CardTitle>
                </CardHeader>
                <CardContent>
                  {patternsLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {patterns && patterns.length > 0 ? (
                        patterns.map((pattern, index) => (
                          <div key={index} className="border border-slate-200 rounded-lg p-4">
                            <div className="flex justify-between mb-2">
                              <h3 className="font-semibold">{pattern.title}</h3>
                              <span className="text-xs text-slate-500">
                                Confidence: {pattern.confidence}%
                              </span>
                            </div>
                            <p className="text-sm mb-2">{pattern.description}</p>
                            <div className="text-xs text-slate-500">
                              Source: {pattern.source}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <h3 className="font-semibold text-amber-800 mb-2">Not Enough Data</h3>
                          <p className="text-sm text-amber-700">
                            Continue logging your pain regularly to help us identify patterns.
                            We recommend at least 7 days of data for meaningful insights.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
