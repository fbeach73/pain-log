import { useEffect } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { user, isLoading, loginMutation, registerMutation, refetchUser } = useAuth();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      email: "",
    },
  });

  // Handle login submission
  const onLoginSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values);
  };

  // Handle registration submission
  const onRegisterSubmit = (values: RegisterFormValues) => {
    const { confirmPassword, ...userData } = values;
    registerMutation.mutate(userData);
  };

  // Effect to handle successful login/registration and force refetch of user data
  useEffect(() => {
    if (loginMutation.isSuccess || registerMutation.isSuccess) {
      refetchUser?.().then(() => {
        console.log("User refetched after successful auth");
        navigate("/");
      });
    }
  }, [loginMutation.isSuccess, registerMutation.isSuccess, refetchUser, navigate]);

  // Get toast hooks and Auth context
  const { toast } = useToast();
  const { storedUserInfo, attemptAutoLogin } = useAuth();

  // Function to handle quick login with stored credentials
  const handleQuickLogin = async () => {
    if (storedUserInfo && storedUserInfo.username) {
      toast({
        title: "Welcome Back",
        description: `Attempting to restore your session, ${storedUserInfo.firstName || storedUserInfo.username}...`,
      });
      
      try {
        // Try to use stored credentials to auto-login
        if (attemptAutoLogin) {
          const result = await attemptAutoLogin(storedUserInfo);
          if (result) {
            // Auto-login successful
            toast({
              title: "Success",
              description: "Your session has been restored!",
            });
            return;
          }
        }
        
        // If auto-login fails or isn't available, at least preset the username
        if (storedUserInfo.username) {
          loginForm.setValue('username', storedUserInfo.username);
          // Focus the password field for quicker login
          setTimeout(() => {
            const passwordField = document.querySelector('input[name="password"]');
            if (passwordField) {
              (passwordField as HTMLInputElement).focus();
            }
          }, 100);
        }
      } catch (error) {
        console.error("Auto-login failed:", error);
        toast({
          title: "Session Restoration Failed",
          description: "Please enter your password to login.",
          variant: "destructive",
        });
      }
    }
  };


  // Attempt to recover session on auth page load
  useEffect(() => {
    // Only try to recover session if we have no user yet and we're not currently loading
    if (!user && !isLoading && refetchUser) {
      console.log("Auth page: Attempting to recover session...");

      // Try to recover the session once on component mount
      refetchUser().then((result) => {
        if (result.data) {
          console.log("Auth page: Session recovered successfully");
        } else {
          console.log("Auth page: No active session found");
          // Session recovery failed, but we won't auto-login anymore
          // User will need to click the dedicated button
        }
      }).catch(error => {
        console.error("Auth page: Failed to recover session:", error);
      });
    }
  }, []);

  // Redirect if already logged in, but add a small delay to prevent flickering
  useEffect(() => {
    if (user) {
      console.log("Auth page: User is authenticated, redirecting to dashboard...");
      // Use a small timeout to prevent flickering during redirects/state changes
      const redirectTimer = setTimeout(() => {
        navigate("/");
      }, 100);

      return () => clearTimeout(redirectTimer);
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row transition-opacity duration-300 opacity-100">
      {/* Left side - auth forms */}
      <div className="w-full md:w-1/2 p-6 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-2">
              <span className="material-symbols-outlined text-5xl text-primary">health_metrics</span>
            </div>
            <h1 className="text-3xl font-bold">Pain Tracking <span className="text-primary">APP</span></h1>
            <p className="text-slate-600 mt-2">Track, Analyze and Manage Your Pain With A Free App From Painclinics.com</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Login to your account</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter your password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                        {loginMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Sign In
                      </Button>
                      <div className="mt-4 pt-4 border-t text-center">
                        {storedUserInfo && storedUserInfo.username && (
                          <div className="mb-4">
                            <Button 
                              variant="outline" 
                              className="w-full text-sm" 
                              onClick={handleQuickLogin}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                              </svg>
                              Continue as {storedUserInfo.firstName || storedUserInfo.username}
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Don't have an account? Use the Register tab to create one.
                        </p>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Create a new account</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Doe" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="email@example.com" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Choose a username" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Create a password" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Confirm your password" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                        {registerMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Create Account
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right side - information */}
      <div className="w-full md:w-1/2 bg-[#f8fafc] p-12 hidden md:flex flex-col justify-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-3xl font-bold mb-6 text-[#1e293b]">Take Control of Your Pain Journey</h2>
          <div className="flex flex-col justify-center gap-4"> {/* Changed to flex-col */}
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-xl mb-1 text-[#1e293b]">Track Your Pain</h3>
                <p className="text-[#475569]">Log and monitor your pain levels, locations, and triggers with standardized assessment tools.</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <div>
                <h3 className="font-semibold text-xl mb-1 text-[#1e293b]">Discover Patterns</h3>
                <p className="text-[#475569]">Visualize your pain data to identify trends, triggers, and effective management strategies.</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253" />
              </svg>
              <div>
                <h3 className="font-semibold text-xl mb-1 text-[#1e293b]">Evidence-Based Resources</h3>
                <p className="text-[#475569]">Access reliable information and management techniques based on the latest medical research.</p>
              </div>
            </div>
          </div>
          <div className="mt-8 p-4 bg-[#e2e8f0] rounded-lg">
            <p className="italic text-[#1e293b]">
              "PainClinics.com PainTracker helps you communicate your pain experience more effectively with healthcare providers, leading to better treatment outcomes."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}