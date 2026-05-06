import { useEffect, useRef, useCallback } from 'react';

interface UseHeartbeatWorkerOptions {
  enabled: boolean;
  interval?: number;
  onPing: () => void | Promise<void>;
}

/**
 * Hook that uses a Web Worker for heartbeat pings.
 * Web Workers are NOT throttled when the tab is in background,
 * making them ideal for VPS/RDP scenarios where the browser window
 * may lose focus but needs to keep running.
 */
export function useHeartbeatWorker({ enabled, interval = 10000, onPing }: UseHeartbeatWorkerOptions) {
  const workerRef = useRef<Worker | null>(null);
  const onPingRef = useRef(onPing);
  
  // Keep callback ref updated
  onPingRef.current = onPing;

  const startWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    try {
      // Create worker from inline code (avoids separate file issues with Vite)
      const workerCode = `
        let intervalId = null;
        
        self.onmessage = (event) => {
          const { action, interval = 10000 } = event.data;
          
          if (action === 'start') {
            if (intervalId) clearInterval(intervalId);
            self.postMessage({ type: 'ping' });
            intervalId = setInterval(() => {
              self.postMessage({ type: 'ping' });
            }, interval);
          } else if (action === 'stop') {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      
      worker.onmessage = (event) => {
        if (event.data.type === 'ping') {
          onPingRef.current();
        }
      };
      
      worker.onerror = (error) => {
        console.error('[HeartbeatWorker] Error:', error);
      };
      
      workerRef.current = worker;
      worker.postMessage({ action: 'start', interval });
      
      // Clean up blob URL
      URL.revokeObjectURL(workerUrl);
      
      console.log('[useHeartbeatWorker] Worker started with interval:', interval);
    } catch (error) {
      console.error('[useHeartbeatWorker] Failed to create worker, falling back to setInterval:', error);
      
      // Fallback to regular interval if Web Workers not supported
      const id = setInterval(() => {
        onPingRef.current();
      }, interval);
      
      // Store cleanup function in worker ref for consistency
      (workerRef as any).current = { 
        terminate: () => clearInterval(id),
        postMessage: () => {}
      };
    }
  }, [interval]);

  const stopWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ action: 'stop' });
      workerRef.current.terminate();
      workerRef.current = null;
      console.log('[useHeartbeatWorker] Worker stopped');
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startWorker();
    } else {
      stopWorker();
    }

    return () => {
      stopWorker();
    };
  }, [enabled, startWorker, stopWorker]);

  return { isRunning: !!workerRef.current };
}
