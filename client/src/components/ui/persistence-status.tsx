import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

type DatabaseStatus = {
  configured: boolean;
  connected: boolean;
  error: string | null;
  sessionPersistence: boolean;
  time: string;
};

export default function PersistenceStatus() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();
  
  useEffect(() => {
    async function checkDatabaseStatus() {
      try {
        const response = await fetch('/api/system/database-status');
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        } else {
          throw new Error(`Failed to fetch database status: ${response.status}`);
        }
      } catch (error) {
        console.error('Error checking database status:', error);
        toast({
          title: 'Database Status Check Failed',
          description: String(error),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    
    checkDatabaseStatus();
  }, [toast]);
  
  if (loading) {
    return (
      <div className="flex items-center space-x-2 bg-background/50 backdrop-blur-sm rounded p-1 px-2 border">
        <div className="h-2 w-2 rounded-full bg-muted animate-pulse"></div>
        <span className="text-xs font-medium text-muted-foreground">Checking persistence...</span>
      </div>
    );
  }
  
  if (!status) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center space-x-2 bg-destructive/10 backdrop-blur-sm rounded p-1 px-2 border border-destructive">
              <div className="h-2 w-2 rounded-full bg-destructive"></div>
              <span className="text-xs font-medium text-muted-foreground">Status check failed</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Unable to verify persistence status</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Determine status color and text
  let statusColor: 'green' | 'yellow' | 'red' = 'red';
  let statusText = 'Not Persistent';
  let tooltip = 'Your data will be lost when the application is restarted or deployed';
  
  if (status.connected && status.sessionPersistence) {
    statusColor = 'green';
    statusText = 'Persistent';
    tooltip = 'Your data and sessions will persist across restarts and deployments';
  } else if (status.connected) {
    statusColor = 'yellow';
    statusText = 'Partial Persistence';
    tooltip = 'Database connected but session persistence may not be working properly';
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center space-x-2 bg-${statusColor === 'green' ? 'green' : statusColor === 'yellow' ? 'yellow' : 'destructive'}/10 backdrop-blur-sm rounded p-1 px-2 border border-${statusColor === 'green' ? 'green' : statusColor === 'yellow' ? 'yellow' : 'destructive'}/50`}>
            <div className={`h-2 w-2 rounded-full bg-${statusColor === 'green' ? 'green-500' : statusColor === 'yellow' ? 'yellow-500' : 'destructive'}`}></div>
            <span className="text-xs font-medium text-muted-foreground">{statusText}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2 max-w-[300px]">
            <p>{tooltip}</p>
            {status.error && (
              <div className="text-xs text-destructive font-mono bg-muted p-1 rounded">
                {status.error}
              </div>
            )}
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span>Database Configured:</span>
                <Badge variant={status.configured ? "success" : "destructive"}>
                  {status.configured ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Database Connected:</span>
                <Badge variant={status.connected ? "success" : "destructive"}>
                  {status.connected ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Session Persistence:</span>
                <Badge variant={status.sessionPersistence ? "success" : "destructive"}>
                  {status.sessionPersistence ? "Working" : "Not Working"}
                </Badge>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}