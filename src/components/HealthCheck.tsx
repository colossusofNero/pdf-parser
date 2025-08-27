// components/HealthCheck.tsx - Add this to monitor app health
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface HealthStatus {
  environment: 'healthy' | 'warning' | 'error';
  pdfWorker: 'healthy' | 'warning' | 'error';
  caspio: 'healthy' | 'warning' | 'error';
  overall: 'healthy' | 'warning' | 'error';
  lastCheck: string;
  details: {
    environmentIssues: string[];
    pdfWorkerIssues: string[];
    caspioIssues: string[];
  };
}

export const HealthCheck: React.FC<{ onHealthChange?: (status: HealthStatus) => void }> = ({ 
  onHealthChange 
}) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const runHealthCheck = async (): Promise<HealthStatus> => {
    const status: HealthStatus = {
      environment: 'healthy',
      pdfWorker: 'healthy',
      caspio: 'healthy',
      overall: 'healthy',
      lastCheck: new Date().toISOString(),
      details: {
        environmentIssues: [],
        pdfWorkerIssues: [],
        caspioIssues: []
      }
    };

    // 1. Check Environment Variables
    try {
      const requiredVars = [
        'VITE_CASPIO_ACCESS_TOKEN',
        'VITE_CASPIO_API_URL',
        'VITE_CASPIO_FILE_UPLOAD_URL'
      ];

      const missingVars = requiredVars.filter(varName => {
        const value = import.meta.env[varName];
        return !value || value.trim() === '';
      });

      if (missingVars.length > 0) {
        status.environment = 'error';
        status.details.environmentIssues.push(`Missing environment variables: ${missingVars.join(', ')}`);
      }

      // Check token format
      const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
      if (token && (token.length < 50 || !token.includes('-'))) {
        status.environment = 'warning';
        status.details.environmentIssues.push('Token format appears invalid');
      }

      // Check API URL format
      const apiUrl = import.meta.env.VITE_CASPIO_API_URL;
      if (apiUrl && !apiUrl.startsWith('https://')) {
        status.environment = 'warning';
        status.details.environmentIssues.push('API URL should use HTTPS');
      }

    } catch (error) {
      status.environment = 'error';
      status.details.environmentIssues.push(`Environment check failed: ${error}`);
    }

    // 2. Check PDF.js Worker
    try {
      const pdfjsLib = await import('pdfjs-dist');
      
      // Try to create a simple PDF document
      const testArrayBuffer = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34 // "%PDF-1.4"
      ]).buffer;

      const loadingTask = pdfjsLib.getDocument({ data: testArrayBuffer });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PDF worker timeout')), 3000);
      });

      try {
        await Promise.race([loadingTask.promise, timeoutPromise]);
        // PDF worker is functional
      } catch (pdfError: any) {
        if (pdfError.message?.includes('timeout')) {
          status.pdfWorker = 'warning';
          status.details.pdfWorkerIssues.push('PDF worker slow to respond');
        } else {
          status.pdfWorker = 'error';
          status.details.pdfWorkerIssues.push(`PDF worker error: ${pdfError.message}`);
        }
      }
    } catch (error: any) {
      status.pdfWorker = 'error';
      status.details.pdfWorkerIssues.push(`PDF.js initialization failed: ${error.message}`);
    }

    // 3. Check Caspio API Connection
    try {
      const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
      const apiUrl = import.meta.env.VITE_CASPIO_API_URL;

      if (token && apiUrl) {
        // Test with a simple HEAD request or minimal GET
        const testUrl = apiUrl.replace('/records', ''); // Get table info instead
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.status === 401) {
            status.caspio = 'error';
            status.details.caspioIssues.push('Invalid or expired access token');
          } else if (response.status === 403) {
            status.caspio = 'error';
            status.details.caspioIssues.push('Access token lacks required permissions');
          } else if (!response.ok && response.status !== 404) {
            // 404 might be normal if testing wrong endpoint
            status.caspio = 'warning';
            status.details.caspioIssues.push(`Caspio API returned ${response.status}: ${response.statusText}`);
          }
          // If we get here with no errors, Caspio is reachable
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            status.caspio = 'warning';
            status.details.caspioIssues.push('Caspio API timeout - slow network?');
          } else {
            status.caspio = 'error';
            status.details.caspioIssues.push(`Cannot reach Caspio API: ${fetchError.message}`);
          }
        }
      } else {
        status.caspio = 'error';
        status.details.caspioIssues.push('Missing Caspio configuration');
      }
    } catch (error: any) {
      status.caspio = 'error';
      status.details.caspioIssues.push(`Caspio health check failed: ${error.message}`);
    }

    // 4. Determine Overall Status
    const componentStatuses = [status.environment, status.pdfWorker, status.caspio];
    if (componentStatuses.includes('error')) {
      status.overall = 'error';
    } else if (componentStatuses.includes('warning')) {
      status.overall = 'warning';
    } else {
      status.overall = 'healthy';
    }

    return status;
  };

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const newStatus = await runHealthCheck();
      setHealthStatus(newStatus);
      onHealthChange?.(newStatus);
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Run health check on mount and periodically
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'error': return 'bg-red-50 border-red-200';
    }
  };

  if (!healthStatus) {
    return (
      <div className="p-4 bg-gray-50 border rounded-lg">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Checking system health...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 border rounded-lg ${getStatusColor(healthStatus.overall)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon(healthStatus.overall)}
          <span className="font-medium">
            System Status: {healthStatus.overall === 'healthy' ? 'All Systems Operational' : 
                           healthStatus.overall === 'warning' ? 'Some Issues Detected' : 
                           'Critical Issues Found'}
          </span>
        </div>
        <button
          onClick={checkHealth}
          disabled={isChecking}
          className="flex items-center space-x-1 px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="flex items-center space-x-2">
          {getStatusIcon(healthStatus.environment)}
          <span>Environment</span>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon(healthStatus.pdfWorker)}
          <span>PDF Engine</span>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon(healthStatus.caspio)}
          <span>Caspio API</span>
        </div>
      </div>

      {/* Show details for warnings/errors */}
      {(healthStatus.overall !== 'healthy') && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <details className="text-sm">
            <summary className="cursor-pointer font-medium mb-2">View Details</summary>
            {healthStatus.details.environmentIssues.length > 0 && (
              <div className="mb-2">
                <strong>Environment Issues:</strong>
                <ul className="list-disc list-inside ml-4">
                  {healthStatus.details.environmentIssues.map((issue, i) => (
                    <li key={i} className="text-red-600">{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {healthStatus.details.pdfWorkerIssues.length > 0 && (
              <div className="mb-2">
                <strong>PDF Engine Issues:</strong>
                <ul className="list-disc list-inside ml-4">
                  {healthStatus.details.pdfWorkerIssues.map((issue, i) => (
                    <li key={i} className="text-red-600">{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {healthStatus.details.caspioIssues.length > 0 && (
              <div className="mb-2">
                <strong>Caspio API Issues:</strong>
                <ul className="list-disc list-inside ml-4">
                  {healthStatus.details.caspioIssues.map((issue, i) => (
                    <li key={i} className="text-red-600">{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </details>
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        Last checked: {new Date(healthStatus.lastCheck).toLocaleString()}
      </div>
    </div>
  );
};
