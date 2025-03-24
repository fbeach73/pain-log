import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertMedicationSchema } from "@shared/schema";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const medicationSchema = insertMedicationSchema.extend({
  timeOfDay: z.array(z.string()).min(1, "At least one time of day is required")
});

type MedicationFormValues = z.infer<typeof medicationSchema>;

type AddMedicationFormProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AddMedicationForm({ isOpen, onClose }: AddMedicationFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [times, setTimes] = useState<string[]>(['Morning']);
  
  // Reset the form when the dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimes(['Morning']);
      form.reset({
        name: "",
        dosage: "",
        frequency: "Daily",
        timeOfDay: ["Morning"]
      });
    }
  }, [isOpen]);
  
  const form = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      name: "",
      dosage: "",
      frequency: "Daily",
      timeOfDay: ["Morning"]
    },
    mode: "onChange"
  });
  
  const addMedicationMutation = useMutation({
    mutationFn: async (values: MedicationFormValues) => {
      try {
        console.log("Adding medication with values:", JSON.stringify(values, null, 2));
        
        // Add the userId to the request data
        const requestData = {
          ...values,
          userId: user?.id,
          timeOfDay: Array.isArray(values.timeOfDay) 
            ? values.timeOfDay.filter((item): item is string => 
                typeof item === 'string' && item.trim() !== ''
              ) 
            : typeof values.timeOfDay === 'object' 
              ? Object.values(values.timeOfDay)
                  .filter((item): item is string => 
                    typeof item === 'string' && item.trim() !== ''
                  )
              : []
        };
        
        if (!requestData.userId) {
          throw new Error("User ID is required");
        }
        
        if (requestData.timeOfDay.length === 0) {
          throw new Error("At least one time of day is required");
        }
        
        console.log("Sending cleaned medication data:", JSON.stringify(requestData, null, 2));
        
        const res = await apiRequest("POST", "/api/medications", requestData);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to add medication");
        }
        const data = await res.json();
        console.log("Medication added response:", data);
        return data;
      } catch (error) {
        console.error("Error adding medication:", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("Medication added successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/medications/today"] });
      form.reset();
      onClose();
      toast({
        title: "Medication added",
        description: "Your medication has been added successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Medication add error:", error);
      toast({
        title: "Failed to add medication",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  });
  
  const onSubmit = (values: MedicationFormValues) => {
    // Ensure the timeOfDay field has all the added times
    // Filter out any empty strings from the times array
    const filteredTimes = times.filter(time => time.trim() !== '');
    
    if (filteredTimes.length === 0) {
      form.setError("timeOfDay", { 
        type: "manual", 
        message: "At least one time of day is required" 
      });
      return;
    }
    
    // Create a clean copy of the values with the filtered times
    const formData = {
      ...values,
      timeOfDay: filteredTimes
    };
    
    console.log("Submitting medication with data:", JSON.stringify(formData, null, 2));
    addMedicationMutation.mutate(formData);
  };
  
  const addTime = () => {
    const newTimes = [...times, ''];
    setTimes(newTimes);
    form.setValue("timeOfDay", newTimes);
  };
  
  const removeTime = (index: number) => {
    const newTimes = [...times];
    newTimes.splice(index, 1);
    setTimes(newTimes);
    form.setValue("timeOfDay", newTimes);
  };
  
  const updateTime = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
    
    // Update the form value for timeOfDay
    form.setValue("timeOfDay", newTimes);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Medication</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medication Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Ibuprofen" value={field.value || ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="dosage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dosage</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 400mg" value={field.value || ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Daily, Twice daily" value={field.value || ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div>
              <FormLabel>Time of Day</FormLabel>
              <div className="space-y-2 mt-1.5">
                {times.map((time, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      placeholder="e.g., Morning, 8:00 AM"
                      value={time}
                      onChange={(e) => updateTime(index, e.target.value)}
                      className="flex-1"
                    />
                    {times.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeTime(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTime}
                  className="w-full mt-2"
                >
                  Add Another Time
                </Button>
              </div>
              {form.formState.errors.timeOfDay && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {form.formState.errors.timeOfDay.message}
                </p>
              )}
            </div>
            
            <DialogFooter className="flex justify-between">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={addMedicationMutation.isPending}
                onClick={form.handleSubmit(onSubmit)}
              >
                {addMedicationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Add Medication
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}