import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Bell, LogOut, User, X } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";

export default function Header() {
  const [, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [hasNotifications, setHasNotifications] = useState(true);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  
  // Sample notifications - in a real app these would come from the backend
  const [notifications] = useState([
    {
      id: 1,
      title: "Pain pattern detected",
      message: "We've noticed increased pain levels after physical activity. Consider gentle stretching before exercise.",
      date: "Just now",
      read: false
    },
    {
      id: 2,
      title: "Medication reminder",
      message: "Remember to log whether your medications are helping with pain relief.",
      date: "Yesterday",
      read: false
    }
  ]);

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const markAllAsRead = () => {
    setHasNotifications(false);
    setIsNotificationOpen(false);
  };

  const getNameInitials = (): string => {
    if (!user) return "GT";
    
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    
    if (user.firstName) {
      return user.firstName[0].toUpperCase();
    }
    
    return user.username[0].toUpperCase();
  };

  return (
    <header className="bg-white shadow-sm py-4 px-4 sm:px-6 md:px-8 sticky top-0 z-10">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <a className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3 3 3-3" />
              </svg>
              <h1 className="ml-2 text-xl font-semibold">PainClinics.com <span className="text-primary">PainTracker</span></h1>
            </a>
          </Link>
        </div>
        
        <div className="flex items-center">
          <div className="mr-3 relative">
            <Popover open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Bell className="h-5 w-5 text-slate-600" />
                  {hasNotifications && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500"></span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between bg-slate-50 p-3 border-b">
                  <h3 className="font-medium">Notifications</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={markAllAsRead}
                    className="text-xs h-8"
                  >
                    Mark all as read
                  </Button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    <div>
                      {notifications.map((notification) => (
                        <div key={notification.id} className="p-3 border-b hover:bg-slate-50">
                          <div className="flex justify-between">
                            <h4 className="font-medium text-sm">{notification.title}</h4>
                            <span className="text-xs text-slate-500">{notification.date}</span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-slate-500">No new notifications</p>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{getNameInitials()}</AvatarFallback>
                </Avatar>
                <span className="ml-2 text-sm font-medium hidden sm:block">
                  {user?.firstName || user?.username}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
