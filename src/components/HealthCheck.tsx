// components/HealthCheck.tsx - Fixed version with proper error handling
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

  const createInitialStatus = (): HealthStatus => ({
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
  });

  const runHealthCheck = async (): Promise<HealthStatus> => {
    const status = createInitialStatus();

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
      } else {
        status.details.environmentIssues.push('✓ All environment variables present');
      }

      // Check token format - Caspio tokens are typically long and contain hyphens
      const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
      if (token) {
        if (token.length < 50 || !token.includes('-')) {
          status.environment = 'warning';
          status.details.environmentIssues.push('Token format appears invalid (should be long with hyphens)');
        } else {
          status.details.environmentIssues.push('✓ Token format looks valid');
        }
      }

      // Check API URL format and extract table name
      const apiUrl = import.meta.env.VITE_CASPIO_API_URL;
      if (apiUrl) {
        if (!apiUrl.startsWith('https://')) {
          status.environment = 'warning';
          status.details.environmentIssues.push('API URL should use HTTPS');
        }
        
        // Extract table name from URL
        const tableMatch = apiUrl.match(/\/tables\/([^\/]+)/);
        if (tableMatch) {
          const tableName = tableMatch[1];
          status.details.environmentIssues.push(`Configured table: ${tableName}`);
        } else {
          status.environment = 'warning';
          status.details.environmentIssues.push('Cannot parse table name from API URL');
        }
      }

      // Check file upload URL format
      const fileUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL;
      if (fileUrl) {
        if (!fileUrl.startsWith('https://')) {
          status.environment = 'warning';
          status.details.environmentIssues.push('File upload URL should use HTTPS');
        } else {
          status.details.environmentIssues.push('✓ File upload URL configured');
        }
      }

    } catch (error) {
      status.environment = 'error';
      status.details.environmentIssues.push(`Environment check failed: ${error}`);
    }

    // 2. Check PDF.js Worker
    try {
      const pdfjsLib = await import('pdfjs-dist');
      
      // Verify the module exists and has required functions
      if (typeof pdfjsLib.getDocument !== 'function') {
        status.pdfWorker = 'error';
        status.details.pdfWorkerIssues.push('PDF.js getDocument function not available');
      } else {
        status.details.pdfWorkerIssues.push('✓ PDF.js module loaded successfully');
      }

      // Check if worker URL is accessible (basic test)
      if (typeof pdfjsLib.GlobalWorkerOptions !== 'undefined') {
        status.details.pdfWorkerIssues.push('✓ Worker support available');
      } else {
        status.pdfWorker = 'warning';
        status.details.pdfWorkerIssues.push('PDF.js worker configuration may need attention');
      }
    } catch (error: any) {
      status.pdfWorker = 'error';
      status.details.pdfWorkerIssues.push(`PDF.js initialization failed: ${error.message}`);
    }

    // 3. Check Caspio API Connection
    try {
      const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
      const apiUrl = import.meta.env.VITE_CASPIO_API_URL;

      if (!token || !apiUrl) {
        status.caspio = 'error';
        status.details.caspioIssues.push('Missing Caspio configuration (token or URL)');
      } else {
        // Extract the base API URL and table name
        const tableMatch = apiUrl.match(/^(https:\/\/[^\/]+\/rest\/v2)\/tables\/([^\/]+)/);
        if (!tableMatch) {
          status.caspio = 'error';
          status.details.caspioIssues.push('Invalid API URL format');
        } else {
          const baseUrl = tableMatch[1];
          const tableName = tableMatch[2];

          // Test connection with table schema endpoint (lighter than records)
          const schemaUrl = `${baseUrl}/tables/${tableName}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          try {
            console.log(`Testing Caspio connection to table: ${tableName}`);
            
            const response = await fetch(schemaUrl, {
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
              status.details.caspioIssues.push(`❌ Invalid or expired access token for table '${tableName}'`);
              status.details.caspioIssues.push('Check if token has permission for this table or if it has expired');
            } else if (response.status === 403) {
              status.caspio = 'error';
              status.details.caspioIssues.push(`❌ Access token lacks required permissions for table '${tableName}'`);
            } else if (response.status === 404) {
              status.caspio = 'error';
              status.details.caspioIssues.push(`❌ Table '${tableName}' not found - check table name in API URL`);
            } else if (!response.ok) {
              status.caspio = 'warning';
              status.details.caspioIssues.push(`⚠️ Caspio API returned ${response.status}: ${response.statusText} for table '${tableName}'`);
            } else {
              // Success! Let's also verify we can read the table structure
              try {
                const tableInfo = await response.json();
                console.log('Table schema retrieved successfully:', tableInfo);
                
                // Verify table has expected structure
                if (tableInfo && typeof tableInfo === 'object') {
                  status.details.caspioIssues.push(`✓ Connected to table '${tableName}' successfully`);
                } else {
                  status.caspio = 'warning';
                  status.details.caspioIssues.push(`⚠️ Connected to '${tableName}' but schema format unexpected`);
                }
              } catch (parseError) {
                status.caspio = 'warning';
                status.details.caspioIssues.push(`⚠️ Connected to '${tableName}' but could not parse table schema`);
              }
            }
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              status.caspio = 'warning';
              status.details.caspioIssues.push(`⚠️ Caspio API timeout (>8s) for table '${tableName}' - network or server issues`);
            } else {
              status.caspio = 'error';
              status.details.caspioIssues.push(`❌ Cannot reach Caspio API for table '${tableName}': ${fetchError.message}`);
            }
          }

          // Also test file upload endpoint if configured
          const fileUploadUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL;
          if (fileUploadUrl) {
            try {
              const fileController = new AbortController();
              const fileTimeoutId = setTimeout(() => fileController.abort(), 5000);

              // Test OPTIONS request first (more appropriate for upload endpoints)
              const fileResponse = await fetch(fileUploadUrl, {
                method: 'OPTIONS',
                headers: {
                  'Authorization': `Bearer ${token}`
                },
                signal: fileController.signal
              });

              clearTimeout(fileTimeoutId);

              if (fileResponse.status === 401) {
                status.caspio = 'error';
                status.details.caspioIssues.push('❌ File upload: Invalid or expired access token');
              } else if (fileResponse.status === 403) {
                status.caspio = 'error';
                status.details.caspioIssues.push('❌ File upload: Access token lacks file upload permissions');
              } else if (fileResponse.ok || fileResponse.status === 405 || fileResponse.status === 200) {
                // 405 Method Not Allowed is normal for OPTIONS on some endpoints
                // 200 OK means OPTIONS is supported
                status.details.caspioIssues.push('✓ File upload endpoint accessible');
              } else {
                status.caspio = 'warning';
                status.details.caspioIssues.push(`⚠️ File upload endpoint returned ${fileResponse.status}`);
              }
            } catch (fileError: any) {
              if (fileError.name !== 'AbortError') {
                status.caspio = 'warning';
                status.details.caspioIssues.push(`⚠️ File upload test failed: ${fileError.message}`);
              }
            }
          }
        }
      }

    } catch (error: any) {
      status.caspio = 'error';
      status.details.caspioIssues.push(`❌ Caspio health check failed: ${error.message}`);
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
      // Create a fallback status with proper structure
      const errorStatus: HealthStatus = {
        environment: 'error',
        pdfWorker: 'error',
        caspio: 'error',
        overall: 'error',
        lastCheck: new Date().toISOString(),
        details: {
          environmentIssues: [`❌ Health check system error: ${error}`],
          pdfWorkerIssues: ['❌ Health check system error'],
          caspioIssues: ['❌ Health check system error']
        }
      };
      setHealthStatus(errorStatus);
      onHealthChange?.(errorStatus);
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

      {/* Always show details */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <details className="text-sm" open={healthStatus.overall !== 'healthy'}>
          <summary className="cursor-pointer font-medium mb-2">
            {healthStatus.overall === 'healthy' ? 'System Details' : 'Issues & Details'}
          </summary>
          
          {/* Environment Details */}
          <div className="mb-3">
            <strong>Environment:</strong>
            <ul className="list-disc list-inside ml-4 mt-1">
              {healthStatus.details.environmentIssues.map((issue, i) => (
                <li key={i} className={
                  issue.startsWith('✓') ? 'text-green-600' : 
                  issue.startsWith('⚠️') ? 'text-yellow-600' :
                  issue.startsWith('❌') ? 'text-red-600' :
                  issue.startsWith('Configured') ? 'text-blue-600' : 
                  'text-gray-600'
                }>
                  {issue}
                </li>
              ))}
            </ul>
          </div>

          {/* PDF Engine Details */}
          <div className="mb-3">
            <strong>PDF Engine:</strong>
            <ul className="list-disc list-inside ml-4 mt-1">
              {healthStatus.details.pdfWorkerIssues.length === 0 ? (
                <li className="text-green-600">✓ No issues detected</li>
              ) : (
                healthStatus.details.pdfWorkerIssues.map((issue, i) => (
                  <li key={i} className={
                    issue.startsWith('✓') ? 'text-green-600' : 
                    issue.startsWith('⚠️') ? 'text-yellow-600' :
                    issue.startsWith('❌') ? 'text-red-600' :
                    'text-gray-600'
                  }>
                    {issue}
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Caspio Details */}
          <div className="mb-2">
            <strong>Caspio API:</strong>
            <ul className="list-disc list-inside ml-4 mt-1">
              {healthStatus.details.caspioIssues.length === 0 ? (
                <li className="text-green-600">✓ No issues detected</li>
              ) : (
                healthStatus.details.caspioIssues.map((issue, i) => (
                  <li key={i} className={
                    issue.startsWith('✓') ? 'text-green-600' : 
                    issue.startsWith('⚠️') ? 'text-yellow-600' :
                    issue.startsWith('❌') ? 'text-red-600' :
                    'text-gray-600'
                  }>
                    {issue}
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Show actionable recommendations for critical issues */}
          {healthStatus.overall === 'error' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
              <strong className="text-red-800">Recommended Actions:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-red-700">
                {healthStatus.details.caspioIssues.some(issue => issue.includes('401')) && (
                  <li>Check if your Caspio access token has expired or lacks permissions for the configured table</li>
                )}
                {healthStatus.details.caspioIssues.some(issue => issue.includes('404')) && (
                  <li>Verify the table name in your VITE_CASPIO_API_URL environment variable</li>
                )}
                {healthStatus.details.environmentIssues.some(issue => issue.includes('Missing')) && (
                  <li>Add missing environment variables to your .env file</li>
                )}
              </ul>
            </div>
          )}
        </details>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Last checked: {new Date(healthStatus.lastCheck).toLocaleString()}
      </div>
    </div>
  );
};
