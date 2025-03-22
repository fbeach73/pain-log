import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import NavigationTabs from "@/components/layout/navigation-tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Play, BookOpen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Resource = {
  id: string;
  title: string;
  description: string;
  type: "article" | "video" | "exercise" | "guide";
  source: string;
  url: string;
  tags: string[];
};

export default function ResourcesPage() {
  const { data: resources, isLoading } = useQuery<Resource[]>({
    queryKey: ["/api/resources"],
  });
  
  const getResourcesByType = (type: string) => {
    return resources?.filter(resource => resource.type === type) || [];
  };
  
  const getResourceIcon = (type: string) => {
    switch(type) {
      case "video": return <Play className="h-5 w-5 text-primary" />;
      case "article": return <FileText className="h-5 w-5 text-primary" />;
      case "exercise": return <Play className="h-5 w-5 text-primary" />;
      case "guide": return <BookOpen className="h-5 w-5 text-primary" />;
      default: return <FileText className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <NavigationTabs />
      
      <main className="flex-1 bg-slate-50">
        <div className="container max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2">Pain Management Resources</h1>
          <p className="text-slate-600 mb-6">Evidence-based information to help you understand and manage your pain</p>
          
          <Tabs defaultValue="all">
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Resources</TabsTrigger>
              <TabsTrigger value="exercises">Exercises</TabsTrigger>
              <TabsTrigger value="articles">Articles</TabsTrigger>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="guides">Guides</TabsTrigger>
            </TabsList>
            
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                <TabsContent value="all">
                  <div className="space-y-6">
                    {resources && resources.length > 0 ? (
                      resources.map((resource) => (
                        <ResourceCard key={resource.id} resource={resource} />
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-4">
                        No resources available.
                      </p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="exercises">
                  <div className="space-y-6">
                    {getResourcesByType("exercise").length > 0 ? (
                      getResourcesByType("exercise").map((resource) => (
                        <ResourceCard key={resource.id} resource={resource} />
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-4">
                        No exercise resources available.
                      </p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="articles">
                  <div className="space-y-6">
                    {getResourcesByType("article").length > 0 ? (
                      getResourcesByType("article").map((resource) => (
                        <ResourceCard key={resource.id} resource={resource} />
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-4">
                        No article resources available.
                      </p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="videos">
                  <div className="space-y-6">
                    {getResourcesByType("video").length > 0 ? (
                      getResourcesByType("video").map((resource) => (
                        <ResourceCard key={resource.id} resource={resource} />
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-4">
                        No video resources available.
                      </p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="guides">
                  <div className="space-y-6">
                    {getResourcesByType("guide").length > 0 ? (
                      getResourcesByType("guide").map((resource) => (
                        <ResourceCard key={resource.id} resource={resource} />
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-4">
                        No guide resources available.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
          
          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-4">Scientific Sources</h2>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">National Institutes of Health (NIH)</h3>
                    <p className="text-sm text-slate-600">
                      The NIH is the primary U.S. agency responsible for biomedical and health-related research.
                    </p>
                    <a 
                      href="https://www.nih.gov/health-information/pain" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-flex items-center"
                    >
                      Visit NIH Pain Resources
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium">Centers for Disease Control and Prevention (CDC)</h3>
                    <p className="text-sm text-slate-600">
                      The CDC provides evidence-based resources on chronic pain management.
                    </p>
                    <a 
                      href="https://www.cdc.gov/chronicpain/index.html" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-flex items-center"
                    >
                      Visit CDC Chronic Pain Resources
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium">International Association for the Study of Pain (IASP)</h3>
                    <p className="text-sm text-slate-600">
                      IASP is a leading professional organization dedicated to pain research and treatment.
                    </p>
                    <a 
                      href="https://www.iasp-pain.org/resources/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-flex items-center"
                    >
                      Visit IASP Resources
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          {getResourceIcon(resource.type)}
          <div>
            <CardTitle>{resource.title}</CardTitle>
            <CardDescription>Source: {resource.source}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-4">{resource.description}</p>
        <div className="flex justify-between items-center">
          <div className="flex flex-wrap gap-1">
            {resource.tags.map((tag, index) => (
              <span 
                key={index} 
                className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
          <Button asChild size="sm" className="gap-1">
            <a 
              href={resource.url} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              View
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getResourceIcon(type: string) {
  switch(type) {
    case "video": return <Play className="h-5 w-5 text-primary" />;
    case "article": return <FileText className="h-5 w-5 text-primary" />;
    case "exercise": return <Play className="h-5 w-5 text-primary" />;
    case "guide": return <BookOpen className="h-5 w-5 text-primary" />;
    default: return <FileText className="h-5 w-5 text-primary" />;
  }
}
