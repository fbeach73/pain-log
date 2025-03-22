import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertPainEntrySchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, Loader2 } from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PainCharacteristics,
  PainLocations,
  PainTriggers,
} from "@/types/pain";
import { Medication } from "@shared/schema";

const painFormSchema = insertPainEntrySchema.omit({ userId: true }).extend({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  intensity: z.number().min(0).max(10),
  locations: z.array(z.string()).min(1, "Select at least one location"),
  hasMedication: z.boolean(),
  medicationId: z.number().optional(),
});

type PainFormValues = z.infer<typeof painFormSchema>;

export default function PainForm() {
  const [, navigate] = useLocation();
  const { user, refetchUser } = useAuth();
  const { toast } = useToast();
  
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<string[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  
  const { data: medications, refetch: refetchMedications } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
    enabled: !!user,
    staleTime: 0, // Always refetch to ensure we have the latest data
  });
  
  // Ensure we have the latest user data and medications
  useEffect(() => {
    if (user) {
      refetchUser?.();
      refetchMedications();
    }
  }, [user, refetchUser, refetchMedications]);

  const form = useForm<PainFormValues>({
    resolver: zodResolver(painFormSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      intensity: 5,
      locations: [],
      characteristics: [],
      triggers: [],
      notes: "",
      medicationTaken: false,
      medications: [],
      hasMedication: false,
    },
  });

  const logPainMutation = useMutation({
    mutationFn: async (values: PainFormValues) => {
      // Ensure user is available
      if (!user) {
        throw new Error("You must be logged in to save a pain entry");
      }
      
      // Combine date and time into a Date object
      const dateTime = new Date(`${values.date}T${values.time}`);
      
      // Transform form data to match API expectations
      const painData = {
        userId: user.id,
        date: dateTime.toISOString(),
        intensity: values.intensity,
        locations: selectedLocations,
        characteristics: selectedCharacteristics,
        triggers: selectedTriggers,
        notes: values.notes || "",  // Ensure not null
        medicationTaken: values.hasMedication,
        medications: values.hasMedication && values.medicationId 
          ? [values.medicationId.toString()]
          : [],
      };
      
      try {
        const res = await apiRequest("POST", "/api/pain-entries", painData);
        return await res.json();
      } catch (error) {
        console.error("Error saving pain entry:", error);
        throw new Error("Failed to save pain entry. Please ensure you're logged in.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pain-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/triggers"] });
      toast({
        title: "Pain entry logged",
        description: "Your pain information has been saved successfully.",
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: "Failed to log pain",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: PainFormValues) => {
    if (selectedLocations.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select at least one pain location",
        variant: "destructive",
      });
      return;
    }
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your pain entry",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    
    logPainMutation.mutate(values, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Your pain entry has been saved",
        });
        navigate("/");
      },
      onError: (error) => {
        toast({
          title: "Error saving entry",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    });
  };

  const toggleLocation = (location: string) => {
    if (selectedLocations.includes(location)) {
      setSelectedLocations(selectedLocations.filter(loc => loc !== location));
    } else {
      setSelectedLocations([...selectedLocations, location]);
    }
    
    form.setValue("locations", selectedLocations);
  };

  const toggleCharacteristic = (characteristic: string) => {
    if (selectedCharacteristics.includes(characteristic)) {
      setSelectedCharacteristics(selectedCharacteristics.filter(c => c !== characteristic));
    } else {
      setSelectedCharacteristics([...selectedCharacteristics, characteristic]);
    }
    
    form.setValue("characteristics", selectedCharacteristics);
  };

  const toggleTrigger = (trigger: string) => {
    if (selectedTriggers.includes(trigger)) {
      setSelectedTriggers(selectedTriggers.filter(t => t !== trigger));
    } else {
      setSelectedTriggers([...selectedTriggers, trigger]);
    }
    
    form.setValue("triggers", selectedTriggers);
  };

  const getPainIntensityLabel = (intensity: number) => {
    if (intensity <= 2) return "No Pain";
    if (intensity <= 4) return "Mild";
    if (intensity <= 6) return "Moderate";
    if (intensity <= 8) return "Severe";
    return "Worst Possible";
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/")} 
          className="mr-3 rounded-full"
        >
          <ChevronLeft className="h-6 w-6 text-slate-600" />
        </Button>
        <h2 className="text-2xl font-semibold">Log Pain Entry</h2>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Date and Time */}
              <div>
                <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                  When did you experience this pain?
                </FormLabel>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-slate-500">Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-slate-500">Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Pain Scale */}
              <FormField
                control={form.control}
                name="intensity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                      Pain Intensity (0-10)
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={10}
                        step={1}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="[&_.slider-thumb_]:h-6 [&_.slider-thumb_]:w-6 [&_.slider-thumb_]:border-2 [&_.slider-thumb_]:border-primary-500 [&_.slider-track_]:h-2 [&_.slider-track_]:bg-gradient-to-r [&_.slider-track_]:from-green-500 [&_.slider-track_]:via-yellow-400 [&_.slider-track_]:to-red-500"
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>No Pain</span>
                      <span>Mild</span>
                      <span>Moderate</span>
                      <span>Severe</span>
                      <span>Worst Possible</span>
                    </div>
                    <div className="mt-3 text-center">
                      <span className="text-lg font-semibold">{field.value}/10</span>
                      <span className="text-sm text-slate-500 ml-2">
                        ({getPainIntensityLabel(field.value)})
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Pain Location */}
              <div>
                <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                  Pain Location
                </FormLabel>
                <div className="grid grid-cols-2 gap-3">
                  {PainLocations.map((location) => (
                    <Button
                      key={location}
                      type="button"
                      variant="outline"
                      className={`justify-between ${
                        selectedLocations.includes(location)
                          ? "border-primary-300 bg-primary-50 hover:bg-primary-100"
                          : ""
                      }`}
                      onClick={() => toggleLocation(location)}
                    >
                      <span>{location}</span>
                      {selectedLocations.includes(location) && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Pain Characteristics */}
              <div>
                <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                  Pain Characteristics
                </FormLabel>
                <div className="flex flex-wrap gap-2">
                  {PainCharacteristics.map((characteristic) => (
                    <Button
                      key={characteristic}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`rounded-full ${
                        selectedCharacteristics.includes(characteristic)
                          ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                      onClick={() => toggleCharacteristic(characteristic)}
                    >
                      {characteristic}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Potential Triggers */}
              <div>
                <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                  Potential Triggers
                </FormLabel>
                <div className="flex flex-wrap gap-2">
                  {PainTriggers.map((trigger) => (
                    <Button
                      key={trigger}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`rounded-full ${
                        selectedTriggers.includes(trigger)
                          ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                      onClick={() => toggleTrigger(trigger)}
                    >
                      {trigger}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                      Additional Notes
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your pain experience in more detail..."
                        className="resize-none"
                        rows={3}
                        value={field.value || ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Medication Taken */}
              <FormField
                control={form.control}
                name="hasMedication"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                      Did you take any medication?
                    </FormLabel>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        className={`flex-1 ${
                          field.value
                            ? "bg-primary text-white hover:bg-primary/90"
                            : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                        }`}
                        variant={field.value ? "default" : "outline"}
                        onClick={() => field.onChange(true)}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        className={`flex-1 ${
                          !field.value
                            ? "bg-primary text-white hover:bg-primary/90"
                            : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                        }`}
                        variant={!field.value ? "default" : "outline"}
                        onClick={() => field.onChange(false)}
                      >
                        No
                      </Button>
                    </div>
                    
                    {field.value && (
                      <div className="mt-3">
                        <FormField
                          control={form.control}
                          name="medicationId"
                          render={({ field }) => (
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              value={field.value?.toString()}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select medication" />
                              </SelectTrigger>
                              <SelectContent>
                                {medications?.map((med) => (
                                  <SelectItem key={med.id} value={med.id.toString()}>
                                    {med.name} {med.dosage}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Submit Buttons */}
              <div className="flex gap-4">
                <Button 
                  type="submit" 
                  className="flex-1 bg-primary text-white hover:bg-primary/90 font-medium" 
                  disabled={logPainMutation.isPending}
                >
                  {logPainMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Entry
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 border-slate-300 hover:bg-slate-100"
                  onClick={() => navigate("/")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
