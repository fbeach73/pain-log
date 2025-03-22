import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import NavigationTabs from "@/components/layout/navigation-tabs";
import PainForm from "@/components/pain-log/pain-form";

export default function LogPainPage() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <NavigationTabs />
      
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="px-4 py-6 sm:px-6 md:px-8 lg:px-10">
          <PainForm />
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
