import { useAuth } from "@/hooks/use-auth";

export default function WelcomeSection() {
  const { user } = useAuth();
  
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold mb-1">
        Welcome back, {user?.firstName || user?.username}
      </h2>
      <p className="text-slate-600">Here's your pain management overview for today</p>
    </div>
  );
}
