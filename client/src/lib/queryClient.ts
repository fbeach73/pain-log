import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    
    try {
      // Try to parse error as JSON first
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorJson = await res.json();
        errorMessage = errorJson.message || errorJson.error || JSON.stringify(errorJson);
      } else {
        // Fallback to text if not JSON
        const text = await res.text();
        if (text) errorMessage = text;
      }
    } catch (e) {
      // If error parsing fails, use status text
      console.warn('Error parsing error response:', e);
    }
    
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    console.log(`Making ${method} request to ${url}`);
    
    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    if (data) {
      headers['Content-Type'] = 'application/json';
    }
    
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      cache: "no-cache" // Prevent browser caching
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API request error (${method} ${url}):`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        cache: "no-cache", // Prevent browser caching
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log(`401 Unauthorized for ${queryKey[0]}, returning null`);
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error(`Error fetching ${queryKey[0]}:`, error);
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Enable refetching when the window focus changes
      refetchOnMount: true, // Always refetch when component mounts
      refetchOnReconnect: true, // Refetch when reconnecting
      staleTime: 0, // Consider data stale immediately for authentication queries
      retry: (failureCount, error) => {
        // Don't retry on 401, 403 or 404 status
        if (
          error instanceof Error && 
          error.message.startsWith('401:') || 
          error.message.startsWith('403:') || 
          error.message.startsWith('404:')
        ) {
          return false;
        }
        // Only retry 3 times max
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
      gcTime: 10 * 60 * 1000 // 10 minutes
    },
    mutations: {
      retry: (failureCount, error) => {
        // Only retry non-client (4xx) errors
        if (
          error instanceof Error && 
          /^4\d\d:/.test(error.message)
        ) {
          return false;
        }
        // Only retry 2 times max
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    },
  },
});
