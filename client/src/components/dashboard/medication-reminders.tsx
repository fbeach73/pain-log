import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Clock, Settings, Plus, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Medication } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import AddMedicationForm from "./add-medication-form";

type MedicationWithStatus = Medication & {
  takenToday: boolean[];
};

export default function MedicationReminders() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [, navigate] = useLocation();
  
  const { data: medications, isLoading } = useQuery<MedicationWithStatus[]>({
    queryKey: ["/api/medications/today"],
  });

  const takeMedicationMutation = useMutation({
    mutationFn: async ({ medicationId, doseIndex }: { medicationId: number, doseIndex: number }) => {
      const res = await apiRequest("POST", "/api/medications/take", { medicationId, doseIndex });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications/today"] });
      toast({
        title: "Medication tracked",
        description: "Your medication has been marked as taken.",
      });
    }
  });

  const handleTakeMedication = (medicationId: number, doseIndex: number) => {
    takeMedicationMutation.mutate({ medicationId, doseIndex });
  };
  
  const handleManageMedications = () => {
    // In the future, this will navigate to a dedicated medications management page
    toast({
      title: "Coming Soon",
      description: "Medication management page will be available in the next update."
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Today's Medication</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary-600 hover:text-primary-700 flex items-center"
            onClick={handleManageMedications}
          >
            Manage
            <Settings className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {medications && medications.length > 0 ? (
                medications.map((medication) => (
                  <div 
                    key={medication.id}
                    className="flex justify-between items-center p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                        <Clock className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{medication.name} {medication.dosage}</h4>
                        <p className="text-xs text-slate-500">{medication.frequency}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end">
                      {(medication.timeOfDay as string[]).map((time, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className={`text-xs rounded-full m-1 ${
                            medication.takenToday[index] 
                              ? "bg-blue-50 text-blue-700" 
                              : "bg-slate-100 text-slate-700"
                          }`}
                          onClick={() => handleTakeMedication(medication.id, index)}
                          disabled={medication.takenToday[index]}
                        >
                          {time} {medication.takenToday[index] && <Check className="h-3 w-3 ml-1" />}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-500">
                  <p>No medications added yet</p>
                  <p className="text-sm mt-1">Click the button below to add your medications</p>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full text-center py-2 mt-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50"
                onClick={() => setShowForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Medication
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <AddMedicationForm isOpen={showForm} onClose={() => setShowForm(false)} />
    </>
  );
}
