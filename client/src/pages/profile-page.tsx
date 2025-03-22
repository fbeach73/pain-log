import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import NavigationTabs from "@/components/layout/navigation-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  painBackground: z.string().optional(),
  medicalHistory: z.array(z.string()).optional(),
  // Additional profile fields
  age: z.number().min(0).max(120).optional(),
  gender: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  activityLevel: z.string().optional(),
  occupation: z.string().optional(),
  primaryDoctor: z.string().optional(),
  preferredResources: z.array(z.string()).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emailNotifications, setEmailNotifications] = useState(true);
  
  const medicalConditions = [
    "Arthritis",
    "Back Pain",
    "Fibromyalgia",
    "Migraine",
    "Multiple Sclerosis",
    "Neuropathy",
    "Osteoporosis",
    "Sciatica",
    "Other"
  ];
  
  const { data: profile, isLoading } = useQuery<User>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile?.firstName || user?.firstName || "",
      lastName: profile?.lastName || user?.lastName || "",
      email: profile?.email || user?.email || "",
      painBackground: profile?.painBackground || "",
      medicalHistory: profile?.medicalHistory as string[] || [],
      // Initialize additional fields
      age: profile?.age || undefined,
      gender: profile?.gender || "",
      height: profile?.height || "",
      weight: profile?.weight || "",
      allergies: profile?.allergies as string[] || [],
      currentMedications: profile?.currentMedications as string[] || [],
      chronicConditions: profile?.chronicConditions as string[] || [],
      activityLevel: profile?.activityLevel || "",
      occupation: profile?.occupation || "",
      primaryDoctor: profile?.primaryDoctor || "",
      preferredResources: profile?.preferredResources as string[] || [],
    },
  });
  
  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const res = await apiRequest("PATCH", "/api/user/profile", values);
      return await res.json();
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(["/api/user/profile"], updatedProfile);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: ProfileFormValues) => {
    updateProfileMutation.mutate(values);
  };
  
  // Update form when profile data is loaded
  useState(() => {
    if (profile) {
      form.reset({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        painBackground: profile.painBackground || "",
        medicalHistory: profile.medicalHistory as string[] || [],
        // Reset additional fields
        age: profile.age || undefined,
        gender: profile.gender || "",
        height: profile.height || "",
        weight: profile.weight || "",
        allergies: profile.allergies as string[] || [],
        currentMedications: profile.currentMedications as string[] || [],
        chronicConditions: profile.chronicConditions as string[] || [],
        activityLevel: profile.activityLevel || "",
        occupation: profile.occupation || "",
        primaryDoctor: profile.primaryDoctor || "",
        preferredResources: profile.preferredResources as string[] || [],
      });
    }
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <NavigationTabs />
      
      <main className="flex-1 bg-slate-50">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>
          
          <Tabs defaultValue="personal">
            <TabsList className="mb-6">
              <TabsTrigger value="personal">Personal Info</TabsTrigger>
              <TabsTrigger value="medical">Medical History</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="privacy">Privacy & Data</TabsTrigger>
            </TabsList>
            
            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Your first name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Your last name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="Your email address" {...field} />
                            </FormControl>
                            <FormDescription>
                              We'll use this email for notifications and communications.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <h3 className="text-base font-semibold mt-8 mb-4">Demographic Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="age"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Age</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="Your age" 
                                  {...field}
                                  value={field.value || ''}
                                  onChange={(e) => {
                                    const value = e.target.value ? parseInt(e.target.value) : undefined;
                                    field.onChange(value);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="gender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gender</FormLabel>
                              <FormControl>
                                <select 
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  {...field}
                                >
                                  <option value="">Select gender</option>
                                  <option value="male">Male</option>
                                  <option value="female">Female</option>
                                  <option value="non-binary">Non-binary</option>
                                  <option value="prefer-not-to-say">Prefer not to say</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <FormField
                          control={form.control}
                          name="height"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Height</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., 5'10 or 178cm" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="weight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Weight</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., 160lbs or 73kg" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <h3 className="text-base font-semibold mt-8 mb-4">Healthcare Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="primaryDoctor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Primary Doctor</FormLabel>
                              <FormControl>
                                <Input placeholder="Your doctor's name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="occupation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Occupation</FormLabel>
                              <FormControl>
                                <Input placeholder="Your current job or role" {...field} />
                              </FormControl>
                              <FormDescription>
                                Helps identify occupational pain triggers
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="activityLevel"
                        render={({ field }) => (
                          <FormItem className="mt-4">
                            <FormLabel>Activity Level</FormLabel>
                            <FormControl>
                              <select 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                {...field}
                              >
                                <option value="">Select activity level</option>
                                <option value="sedentary">Sedentary (little to no exercise)</option>
                                <option value="light">Light (light exercise 1-3 days/week)</option>
                                <option value="moderate">Moderate (moderate exercise 3-5 days/week)</option>
                                <option value="active">Active (hard exercise 6-7 days/week)</option>
                                <option value="very-active">Very Active (very hard exercise & physical job)</option>
                              </select>
                            </FormControl>
                            <FormDescription>
                              Your typical level of physical activity
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="painBackground"
                        render={({ field }) => (
                          <FormItem className="mt-4">
                            <FormLabel>Pain History</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Briefly describe your pain background and history..."
                                className="min-h-[100px]"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              This information helps us provide more personalized recommendations.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end mt-6">
                        <Button type="submit" disabled={updateProfileMutation.isPending}>
                          {updateProfileMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="medical">
              <Card>
                <CardHeader>
                  <CardTitle>Medical History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="space-y-8">
                        <div>
                          <FormLabel className="text-base font-semibold">Medical Conditions</FormLabel>
                          <FormDescription>
                            Select any medical conditions that are relevant to your pain.
                          </FormDescription>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <FormField
                              control={form.control}
                              name="medicalHistory"
                              render={() => (
                                <>
                                  {medicalConditions.map((condition) => (
                                    <FormItem 
                                      key={condition}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={form.getValues("medicalHistory")?.includes(condition)}
                                          onCheckedChange={(checked) => {
                                            const currentValues = form.getValues("medicalHistory") || [];
                                            
                                            if (checked) {
                                              form.setValue("medicalHistory", [
                                                ...currentValues,
                                                condition
                                              ]);
                                            } else {
                                              form.setValue(
                                                "medicalHistory",
                                                currentValues.filter((value) => value !== condition)
                                              );
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal cursor-pointer">
                                        {condition}
                                      </FormLabel>
                                    </FormItem>
                                  ))}
                                </>
                              )}
                            />
                          </div>
                        </div>

                        <div>
                          <FormLabel className="text-base font-semibold">Chronic Conditions</FormLabel>
                          <FormDescription>
                            Select any chronic conditions you have been diagnosed with.
                          </FormDescription>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <FormField
                              control={form.control}
                              name="chronicConditions"
                              render={() => (
                                <>
                                  {["Rheumatoid Arthritis", "Fibromyalgia", "Chronic Fatigue Syndrome", 
                                    "Lupus", "Diabetes", "Hypertension", "Heart Disease", "Asthma"].map((condition) => (
                                    <FormItem 
                                      key={condition}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={form.getValues("chronicConditions")?.includes(condition)}
                                          onCheckedChange={(checked) => {
                                            const currentValues = form.getValues("chronicConditions") || [];
                                            
                                            if (checked) {
                                              form.setValue("chronicConditions", [
                                                ...currentValues,
                                                condition
                                              ]);
                                            } else {
                                              form.setValue(
                                                "chronicConditions",
                                                currentValues.filter((value) => value !== condition)
                                              );
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal cursor-pointer">
                                        {condition}
                                      </FormLabel>
                                    </FormItem>
                                  ))}
                                </>
                              )}
                            />
                          </div>
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="allergies"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold">Allergies</FormLabel>
                              <FormDescription>
                                List any allergies you have, especially to medications.
                              </FormDescription>
                              <div className="flex flex-wrap gap-2 mt-3">
                                {field.value?.map((allergy, index) => (
                                  <div key={index} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full">
                                    <span>{allergy}</span>
                                    <button
                                      type="button"
                                      className="text-slate-500 hover:text-slate-700"
                                      onClick={() => {
                                        const newValues = [...field.value];
                                        newValues.splice(index, 1);
                                        field.onChange(newValues);
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div className="flex mt-2">
                                <Input
                                  placeholder="Add allergy and press Enter"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const value = e.currentTarget.value.trim();
                                      if (value && !(field.value || []).includes(value)) {
                                        field.onChange([...(field.value || []), value]);
                                        e.currentTarget.value = '';
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="currentMedications"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold">Current Medications</FormLabel>
                              <FormDescription>
                                List all medications you are currently taking.
                              </FormDescription>
                              <div className="flex flex-wrap gap-2 mt-3">
                                {field.value?.map((medication, index) => (
                                  <div key={index} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full">
                                    <span>{medication}</span>
                                    <button
                                      type="button"
                                      className="text-slate-500 hover:text-slate-700"
                                      onClick={() => {
                                        const newValues = [...field.value];
                                        newValues.splice(index, 1);
                                        field.onChange(newValues);
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div className="flex mt-2">
                                <Input
                                  placeholder="Add medication and press Enter"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const value = e.currentTarget.value.trim();
                                      if (value && !(field.value || []).includes(value)) {
                                        field.onChange([...(field.value || []), value]);
                                        e.currentTarget.value = '';
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      
                        <div className="flex justify-end mt-6">
                          <Button type="submit" disabled={updateProfileMutation.isPending}>
                            {updateProfileMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Email Notifications</h3>
                        <p className="text-sm text-slate-500">
                          Receive email updates about your pain tracking and insights
                        </p>
                      </div>
                      <Switch
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Pain Log Reminders</h3>
                        <p className="text-sm text-slate-500">
                          Get reminders to log your pain regularly
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Medication Reminders</h3>
                        <p className="text-sm text-slate-500">
                          Receive notifications when it's time to take your medication
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Weekly Summary</h3>
                        <p className="text-sm text-slate-500">
                          Get a weekly summary of your pain trends and insights
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="privacy">
              <Card>
                <CardHeader>
                  <CardTitle>Privacy & Data Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium mb-2">Data Usage</h3>
                      <p className="text-sm text-slate-600 mb-4">
                        We value your privacy. Your data is used only to provide you with personalized pain management insights and is never shared with third parties without your explicit consent.
                      </p>
                      <div className="flex items-center space-x-2">
                        <Switch id="anonymous" />
                        <label htmlFor="anonymous" className="text-sm font-medium cursor-pointer">
                          Contribute anonymized data to research
                        </label>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 ml-7">
                        Help improve pain management research by anonymously sharing your pain data.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">Data Export</h3>
                      <p className="text-sm text-slate-600 mb-4">
                        You can download all your data at any time.
                      </p>
                      <Button variant="outline">Export My Data</Button>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">Account Actions</h3>
                      <div className="space-y-3">
                        <Button variant="outline" className="w-full sm:w-auto">
                          Change Password
                        </Button>
                        <Button variant="outline" className="w-full sm:w-auto text-red-500 hover:text-red-700 hover:bg-red-50">
                          Delete Account
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Deleting your account will permanently remove all your data from our servers.
                      </p>
                    </div>
                  </div>
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
