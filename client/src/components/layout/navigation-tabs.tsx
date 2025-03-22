import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";

type NavItem = {
  path: string;
  label: string;
};

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard" },
  { path: "/log-pain", label: "Log Pain" },
  { path: "/insights", label: "Insights" },
  { path: "/resources", label: "Resources" },
  { path: "/reports", label: "Reports" },
  { path: "/profile", label: "Profile" },
];

export default function NavigationTabs() {
  const [location] = useLocation();

  return (
    <div className="bg-white border-b">
      <div className="px-4 sm:px-6 md:px-8">
        <nav className="flex -mb-px space-x-6 overflow-x-auto">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <a
                className={cn(
                  "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm",
                  location === item.path
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                )}
              >
                {item.label}
              </a>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
