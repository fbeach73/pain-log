import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import NavigationTabs from "@/components/layout/navigation-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Printer, Mail, Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";

type ReportData = {
  id: string;
  generatedOn: string;
  periodStart: string;
  periodEnd: string;
  painEntries: number;
  averagePain: number;
  mostCommonLocation: string;
  mostCommonTrigger: string;
  data: any;
};

export default function ReportsPage() {
  const [reportType, setReportType] = useState("weekly");
  const [isGenerating, setIsGenerating] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  const { data: reports, isLoading } = useQuery<ReportData[]>({
    queryKey: ["/api/reports"],
  });
  
  const handleGenerateReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };
  
  const handleShareReport = (reportId: string) => {
    // Implement sharing functionality
  };
  
  const handleDownloadReport = (reportId: string) => {
    // Implement download functionality
  };
  
  const handlePrintReport = (reportId: string) => {
    // Implement print functionality
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <NavigationTabs />
      
      <main className="flex-1 bg-slate-50">
        <div className="container max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Pain Reports</h1>
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Generate New Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label htmlFor="report-type">Report Type</Label>
                  <Select 
                    value={reportType} 
                    onValueChange={setReportType}
                  >
                    <SelectTrigger id="report-type">
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {reportType === "custom" && (
                  <>
                    <div>
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input 
                        id="start-date" 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">End Date</Label>
                      <Input 
                        id="end-date" 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleGenerateReport} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Report"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <h2 className="text-xl font-semibold mb-4">Recent Reports</h2>
          
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {reports && reports.length > 0 ? (
                reports.map((report) => (
                  <Card key={report.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            Pain Report: {format(new Date(report.periodStart), "MMM d")} - {format(new Date(report.periodEnd), "MMM d, yyyy")}
                          </h3>
                          <p className="text-sm text-slate-500">
                            Generated on {format(new Date(report.generatedOn), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        <div className="flex space-x-2 mt-2 md:mt-0">
                          <Button variant="outline" size="sm" onClick={() => handleShareReport(report.id)}>
                            <Mail className="h-4 w-4 mr-1" />
                            Share
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDownloadReport(report.id)}>
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handlePrintReport(report.id)}>
                            <Printer className="h-4 w-4 mr-1" />
                            Print
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-100 p-3 rounded-lg">
                          <p className="text-sm text-slate-500">Entries</p>
                          <p className="text-xl font-semibold">{report.painEntries}</p>
                        </div>
                        <div className="bg-slate-100 p-3 rounded-lg">
                          <p className="text-sm text-slate-500">Avg. Pain</p>
                          <p className="text-xl font-semibold">{report.averagePain}/10</p>
                        </div>
                        <div className="bg-slate-100 p-3 rounded-lg">
                          <p className="text-sm text-slate-500">Top Location</p>
                          <p className="text-xl font-semibold">{report.mostCommonLocation}</p>
                        </div>
                        <div className="bg-slate-100 p-3 rounded-lg">
                          <p className="text-sm text-slate-500">Top Trigger</p>
                          <p className="text-xl font-semibold">{report.mostCommonTrigger}</p>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                          View Full Report
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-slate-500 mb-4">No reports generated yet.</p>
                    <Button onClick={handleGenerateReport} disabled={isGenerating}>
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Your First Report"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 mb-2">Share with Healthcare Providers</h3>
            <p className="text-sm text-amber-700">
              These reports are designed to help you communicate your pain experience more 
              effectively with healthcare providers. Bring a printed report to your next 
              appointment or share it via email.
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
