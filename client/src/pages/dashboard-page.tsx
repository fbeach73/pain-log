import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import NavigationTabs from "@/components/layout/navigation-tabs";
import WelcomeSection from "@/components/dashboard/welcome-section";
import QuickActions from "@/components/dashboard/quick-actions";
import PainTrendChart from "@/components/dashboard/pain-trend-chart";
import RecentLogs from "@/components/dashboard/recent-logs";
import CommonTriggers from "@/components/dashboard/common-triggers";
import Recommendations from "@/components/dashboard/recommendations";
import MedicationReminders from "@/components/dashboard/medication-reminders";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <NavigationTabs />
      
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="px-4 py-6 sm:px-6 md:px-8 lg:px-10">
          <WelcomeSection />
          <QuickActions />
          <PainTrendChart />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <RecentLogs />
            <CommonTriggers />
          </div>
          
          <Recommendations />
          <MedicationReminders />
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
