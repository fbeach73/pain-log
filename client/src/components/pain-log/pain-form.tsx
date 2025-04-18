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
  date: z.string()
    .min(1, "Date is required")
    .refine(
      (date) => {
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);
        return selectedDate <= today;
      },
      {
        message: "Date cannot be in the future",
      }
    ),
  time: z.string().min(1, "Time is required")
    .refine(
      (time) => {
        // Simple validation that ensures format
        const pattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return pattern.test(time);
      },
      {
        message: "Please enter a valid time in 24-hour format (HH:MM)",
      }
    ),
  intensity: z.number().min(0).max(10),
  locations: z.array(z.string()).min(1, "Select at least one location"),
  hasMedication: z.boolean(),
  medicationId: z.number().optional(),
  mood: z.string().optional(),
  moodRating: z.number().min(1).max(5).optional(),
});

type PainFormValues = z.infer<typeof painFormSchema>;

export default function PainForm() {
  const [, navigate] = useLocation();
  const { user, refetchUser } = useAuth();
  const { toast } = useToast();
  
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<string[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  
  const { data: medications, refetch: refetchMedications, isLoading: isMedicationsLoading } = useQuery<Medication[]>({
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
      mood: "",
      moodRating: 3,
    },
  });

  const logPainMutation = useMutation({
    mutationFn: async (values: PainFormValues) => {
      // Ensure user is available
      if (!user) {
        // Try to refetch user data first
        try {
          console.log("User data not found, attempting to refetch");
          if (refetchUser) {
            const result = await refetchUser();
            if (!result.data) {
              console.log("Refetch failed to get user data");
              // Redirect to login page with a better error message
              toast({
                title: "Login Required",
                description: "Please log in to save your pain entries",
                variant: "destructive",
              });
              setTimeout(() => navigate("/auth"), 1500);
              throw new Error("You must be logged in to save pain entries.");
            }
          } else {
            toast({
              title: "Authentication Error",
              description: "Please log in to continue",
              variant: "destructive",
            });
            setTimeout(() => navigate("/auth"), 1500);
            throw new Error("Authentication error. Please log in to continue.");
          }
        } catch (error) {
          console.error("Error refetching user:", error);
          toast({
            title: "Session Expired",
            description: "Your session has expired. Redirecting to login page...",
            variant: "destructive",
          });
          setTimeout(() => navigate("/auth"), 1500);
          throw new Error("Your session has expired. Please log in again.");
        }
      }
      
      // Double check we have user data before proceeding
      if (!user || !user.id) {
        console.error("No user ID available after refetch attempt");
        toast({
          title: "Authentication Required",
          description: "Please log in to save your pain entries",
          variant: "destructive",
        });
        setTimeout(() => navigate("/auth"), 1500);
        throw new Error("You must be logged in to save pain entries.");
      }
      
      // Combine date and time into a Date object
      const dateTime = new Date(`${values.date}T${values.time}`);
      
      // Transform form data to match API expectations
      const painData = {
        userId: user?.id, // Include userId explicitly in the request
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
        mood: values.mood,
        moodRating: values.moodRating,
      };
      
      console.log("Prepared pain data for submission with userId:", user?.id);
      
      try {
        console.log("Submitting pain entry:", painData);
        const res = await apiRequest("POST", "/api/pain-entries", painData);
        const data = await res.json();
        console.log("Pain entry saved successfully:", data);
        return data;
      } catch (error) {
        console.error("Error saving pain entry:", error);
        // Verify authentication status after error
        if (refetchUser) {
          refetchUser().catch(e => console.error("Failed to verify auth status:", e));
        }
        throw new Error("Failed to save pain entry. Please ensure you're logged in.");
      }
    },
    onSuccess: () => {
      // Invalidate all pain entry-related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/pain-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/triggers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/patterns"] });
      
      // Also refetch user data to ensure we still have a valid session
      if (refetchUser) {
        refetchUser().catch(e => console.error("Failed to refetch user after success:", e));
      }
      
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

  const onSubmit = async (values: PainFormValues) => {
    if (selectedLocations.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select at least one pain location",
        variant: "destructive",
      });
      return;
    }
    
    // First verify user is still authenticated
    let authenticated = !!user;
    
    if (!authenticated && refetchUser) {
      try {
        console.log("No user data, attempting to refetch before submission");
        const result = await refetchUser();
        authenticated = !!result.data;
      } catch (error) {
        console.error("Failed to refetch user data:", error);
      }
    }
    
    // Temporarily allow submission even if not authenticated
    // Just show a warning but continue
    if (!authenticated) {
      console.log("Continuing pain entry submission without authenticated session");
      toast({
        title: "Warning",
        description: "Authentication status unclear. Attempting to save pain entry anyway.",
        variant: "default",
      });
    }
    
    logPainMutation.mutate(values, {
      onSuccess: () => {
        // Invalidate all pain entry-related queries to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/pain-entries"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/recent"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/trend"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/triggers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pain-entries/patterns"] });
        
        toast({
          title: "Success",
          description: "Your pain entry has been saved",
        });
        
        // Refresh user data to ensure we maintain session
        if (refetchUser) {
          refetchUser().catch(e => console.error("Failed to refetch user after submission:", e));
        }
        
        navigate("/");
      },
      onError: (error) => {
        toast({
          title: "Error saving entry",
          description: error.message || "Please try again",
          variant: "destructive",
        });
        
        // If there's an error, check if we're still authenticated
        if (refetchUser) {
          refetchUser().catch(e => console.error("Failed to verify auth after error:", e));
        }
      }
    });
  };

  const toggleLocation = (location: string) => {
    const updatedLocations = selectedLocations.includes(location)
      ? selectedLocations.filter(loc => loc !== location)
      : [...selectedLocations, location];
    
    setSelectedLocations(updatedLocations);
    form.setValue("locations", updatedLocations);
  };

  const toggleCharacteristic = (characteristic: string) => {
    const updatedCharacteristics = selectedCharacteristics.includes(characteristic)
      ? selectedCharacteristics.filter(c => c !== characteristic)
      : [...selectedCharacteristics, characteristic];
    
    setSelectedCharacteristics(updatedCharacteristics);
    form.setValue("characteristics", updatedCharacteristics);
  };

  const toggleTrigger = (trigger: string) => {
    const updatedTriggers = selectedTriggers.includes(trigger)
      ? selectedTriggers.filter(t => t !== trigger)
      : [...selectedTriggers, trigger];
    
    setSelectedTriggers(updatedTriggers);
    form.setValue("triggers", updatedTriggers);
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
      
      {/* Authentication Warning */}
      {!user && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="font-medium text-amber-800 mb-1">Login Required</h3>
            <p className="text-sm text-amber-700">You need to be logged in to save pain entries. Your data won't be saved without an account.</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 bg-white hover:bg-amber-50 text-amber-700 border-amber-300"
              onClick={() => navigate("/auth")}
            >
              Log in or Register
            </Button>
          </div>
        </div>
      )}
      
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
                          ? "border-green-300 bg-green-50/50 hover:bg-green-100/70 text-green-800"
                          : ""
                      }`}
                      onClick={() => toggleLocation(location)}
                    >
                      <span>{location}</span>
                      {selectedLocations.includes(location) && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                          ? "bg-green-50/50 text-green-800 border-green-300 hover:bg-green-100/70"
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
                          ? "bg-green-50/50 text-green-800 border-green-300 hover:bg-green-100/70"
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
                            <>
                              <Select 
                                onValueChange={(value) => field.onChange(parseInt(value))}
                                value={field.value?.toString()}
                                disabled={isMedicationsLoading}
                              >
                                <SelectTrigger>
                                  {isMedicationsLoading ? (
                                    <span className="flex items-center">
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Loading medications...
                                    </span>
                                  ) : (
                                    <SelectValue placeholder="Select medication" />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  {medications && medications.length > 0 ? (
                                    medications.map((med) => (
                                      <SelectItem key={med.id} value={med.id.toString()}>
                                        {med.name} {med.dosage ? `(${med.dosage})` : ''}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="no-med" disabled>
                                      No medications found. Add them in your profile.
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              {!isMedicationsLoading && medications && medications.length === 0 && (
                                <p className="text-sm text-amber-600 mt-2">
                                  You haven't added any medications yet. 
                                  <Button variant="link" className="h-auto p-0 ml-1" onClick={() => navigate("/profile")}>
                                    Add medications in your profile
                                  </Button>
                                </p>
                              )}
                            </>
                          )}
                        />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Mood Tracking */}
              <div>
                <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                  How are you feeling emotionally?
                </FormLabel>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="mood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-slate-500">Mood</FormLabel>
                        <FormControl>
                          <Select 
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select your mood" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="happy">😊 Happy</SelectItem>
                              <SelectItem value="calm">😌 Calm</SelectItem>
                              <SelectItem value="anxious">😟 Anxious</SelectItem>
                              <SelectItem value="sad">😔 Sad</SelectItem>
                              <SelectItem value="frustrated">😤 Frustrated</SelectItem>
                              <SelectItem value="angry">😠 Angry</SelectItem>
                              <SelectItem value="depressed">😞 Depressed</SelectItem>
                              <SelectItem value="hopeful">🙂 Hopeful</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="moodRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-slate-500">
                          Mood Intensity (1-5)
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={1}
                            max={5}
                            step={1}
                            value={[field.value || 3]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="[&_.slider-thumb_]:h-6 [&_.slider-thumb_]:w-6 [&_.slider-thumb_]:border-2 [&_.slider-thumb_]:border-primary-500 [&_.slider-track_]:h-2 [&_.slider-track_]:bg-gradient-to-r [&_.slider-track_]:from-blue-300 [&_.slider-track_]:to-blue-600"
                          />
                        </FormControl>
                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                          <span>Very Mild</span>
                          <span>Mild</span>
                          <span>Moderate</span>
                          <span>Strong</span>
                          <span>Very Strong</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
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
