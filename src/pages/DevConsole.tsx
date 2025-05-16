import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FiTerminal, FiGlobe, FiCode, FiActivity, FiDatabase,
  FiCpu, FiLayers, FiShield, FiZap, FiRefreshCw,
  FiTrash2, FiFilter, FiSearch, FiAlertCircle,
  FiInfo, FiCheckCircle, FiX, FiClock,
  FiMonitor, FiSettings, FiAlertTriangle
} from 'react-icons/fi';

type Tab = 'console' | 'network' | 'elements' | 'sources' | 'performance' | 'memory' | 'application' | 'security' | 'lighthouse';

interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status: number;
  type: string;
  size: string;
  time: string;
  initiator: string;
  timestamp: number;
  response?: any;
  requestHeaders?: HeadersInit;
  responseHeaders?: Headers;
}

interface ConsoleMessage {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
  message: string;
  timestamp: number;
  count: number;
  source: string;
  stack?: string;
  details?: any;
}

interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  description?: string;
}

interface ResourceTiming extends PerformanceResourceTiming {
  resourceType?: string;
}

const DevConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('console');
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [resourceTimings, setResourceTimings] = useState<ResourceTiming[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [consoleFilter, setConsoleFilter] = useState<ConsoleMessage['level'] | 'all'>('all');
  const [networkFilter, setNetworkFilter] = useState<string>('all');
  const [isRecording, setIsRecording] = useState(true);
  const [preserveLog, setPreserveLog] = useState(false);
  const [selectedNetworkRequest, setSelectedNetworkRequest] = useState<NetworkRequest | null>(null);
  
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const originalConsole = useRef<any>({});
  const originalFetch = useRef<typeof window.fetch>(window.fetch);
  const originalXHR = useRef<typeof XMLHttpRequest>(XMLHttpRequest);

  // Capture console messages
  useEffect(() => {
    if (!isRecording) return;

    // Store original console methods
    originalConsole.current = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
      trace: console.trace
    };

    // Override console methods
    const captureConsoleMessage = (level: ConsoleMessage['level']) => {
      return (...args: any[]) => {
        const message = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');

        const stack = level === 'error' || level === 'trace' ? new Error().stack : undefined;

        setConsoleMessages(prev => {
          const existing = prev.find(m => m.message === message && m.level === level);
          if (existing) {
            return prev.map(m => 
              m.id === existing.id 
                ? { ...m, count: m.count + 1, timestamp: Date.now() }
                : m
            );
          }
          
          const newMessage: ConsoleMessage = {
            id: `${Date.now()}-${Math.random()}`,
            level,
            message,
            timestamp: Date.now(),
            count: 1,
            source: 'user',
            stack,
            details: args.length > 1 ? args : undefined
          };

          return [...prev, newMessage];
        });

        // Call original method
        originalConsole.current[level](...args);
      };
    };

    Object.keys(originalConsole.current).forEach(method => {
      console[method as keyof Console] = captureConsoleMessage(method as ConsoleMessage['level']);
    });

    // Capture errors
    const handleError = (event: ErrorEvent) => {
      setConsoleMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        level: 'error',
        message: `${event.message} (${event.filename}:${event.lineno}:${event.colno})`,
        timestamp: Date.now(),
        count: 1,
        source: 'runtime',
        stack: event.error?.stack
      }]);
    };

    window.addEventListener('error', handleError);

    // Capture unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setConsoleMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        level: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        timestamp: Date.now(),
        count: 1,
        source: 'promise',
        stack: event.reason?.stack
      }]);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      // Restore original console methods
      Object.keys(originalConsole.current).forEach(method => {
        console[method as keyof Console] = originalConsole.current[method];
      });
      
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [isRecording]);

  // Capture network requests
  useEffect(() => {
    if (!isRecording) return;

    // Capture fetch requests
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      const startTime = performance.now();
      const requestId = `${Date.now()}-${Math.random()}`;

      try {
        const response = await originalFetch.current(input, init);
        const endTime = performance.now();
        const responseClone = response.clone();
        
        // Try to get response size
        let size = '0';
        try {
          const blob = await responseClone.blob();
          size = blob.size.toString();
        } catch {
          size = response.headers.get('content-length') || '0';
        }

        const networkRequest: NetworkRequest = {
          id: requestId,
          url,
          method,
          status: response.status,
          type: response.headers.get('content-type')?.split(';')[0] || 'fetch',
          size,
          time: `${(endTime - startTime).toFixed(0)}ms`,
          initiator: 'fetch',
          timestamp: Date.now(),
          requestHeaders: init?.headers,
          responseHeaders: response.headers
        };

        setNetworkRequests(prev => [...prev, networkRequest]);

        return response;
      } catch (error) {
        const endTime = performance.now();
        
        setNetworkRequests(prev => [...prev, {
          id: requestId,
          url,
          method,
          status: 0,
          type: 'error',
          size: '0',
          time: `${(endTime - startTime).toFixed(0)}ms`,
          initiator: 'fetch',
          timestamp: Date.now()
        }]);

        throw error;
      }
    };

    // Capture XHR requests
    const XHRProxy = new Proxy(originalXHR.current, {
      construct(target, args) {
        const xhr = new target();
        const requestId = `${Date.now()}-${Math.random()}`;
        let startTime: number;
        let method = '';
        let url = '';

        // Override open method
        const originalOpen = xhr.open;
        xhr.open = function(m: string, u: string, ...rest: any[]) {
          method = m;
          url = u;
          originalOpen.call(this, m, u, ...rest);
        };

        // Override send method
        const originalSend = xhr.send;
        xhr.send = function(body?: any) {
          startTime = performance.now();
          
          // Add event listeners
          xhr.addEventListener('load', () => {
            const endTime = performance.now();
            
            setNetworkRequests(prev => [...prev, {
              id: requestId,
              url,
              method,
              status: xhr.status,
              type: xhr.getResponseHeader('content-type')?.split(';')[0] || 'xhr',
              size: xhr.responseText.length.toString(),
              time: `${(endTime - startTime).toFixed(0)}ms`,
              initiator: 'xhr',
              timestamp: Date.now()
            }]);
          });

          xhr.addEventListener('error', () => {
            const endTime = performance.now();
            
            setNetworkRequests(prev => [...prev, {
              id: requestId,
              url,
              method,
              status: 0,
              type: 'error',
              size: '0',
              time: `${(endTime - startTime).toFixed(0)}ms`,
              initiator: 'xhr',
              timestamp: Date.now()
            }]);
          });

          originalSend.call(this, body);
        };

        return xhr;
      }
    });

    window.XMLHttpRequest = XHRProxy as any;

    return () => {
      window.fetch = originalFetch.current;
      window.XMLHttpRequest = originalXHR.current;
    };
  }, [isRecording]);

  // Capture performance metrics
  useEffect(() => {
    if (!isRecording) return;

    const capturePerformanceMetrics = () => {
      const metrics: PerformanceMetric[] = [];

      // Navigation timing
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const navigationStart = timing.navigationStart;

        metrics.push(
          {
            id: 'page-load',
            name: 'Page Load Time',
            value: timing.loadEventEnd - navigationStart,
            unit: 'ms',
            timestamp: Date.now(),
            description: 'Total time from navigation start to load event end'
          },
          {
            id: 'dom-content-loaded',
            name: 'DOM Content Loaded',
            value: timing.domContentLoadedEventEnd - navigationStart,
            unit: 'ms',
            timestamp: Date.now(),
            description: 'Time until DOM is fully loaded and parsed'
          },
          {
            id: 'first-paint',
            name: 'First Paint',
            value: timing.responseEnd - navigationStart,
            unit: 'ms',
            timestamp: Date.now(),
            description: 'Time until first pixels are rendered'
          }
        );
      }

      // Memory usage (Chrome only)
      if (window.performance && (window.performance as any).memory) {
        const memory = (window.performance as any).memory;
        metrics.push(
          {
            id: 'heap-used',
            name: 'JS Heap Used',
            value: Math.round(memory.usedJSHeapSize / 1048576),
            unit: 'MB',
            timestamp: Date.now(),
            description: 'Current JavaScript heap memory usage'
          },
          {
            id: 'heap-total',
            name: 'JS Heap Total',
            value: Math.round(memory.totalJSHeapSize / 1048576),
            unit: 'MB',
            timestamp: Date.now(),
            description: 'Total allocated JavaScript heap memory'
          },
          {
            id: 'heap-limit',
            name: 'JS Heap Limit',
            value: Math.round(memory.jsHeapSizeLimit / 1048576),
            unit: 'MB',
            timestamp: Date.now(),
            description: 'Maximum JavaScript heap memory limit'
          }
        );
      }

      setPerformanceMetrics(metrics);

      // Resource timings
      if (window.performance && window.performance.getEntriesByType) {
        const resources = window.performance.getEntriesByType('resource') as ResourceTiming[];
        setResourceTimings(resources.map(r => ({
          ...r,
          resourceType: r.name.split('.').pop()?.split('?')[0] || 'unknown'
        })));
      }
    };

    // Initial capture
    capturePerformanceMetrics();

    // Update every 5 seconds
    const interval = setInterval(capturePerformanceMetrics, 5000);

    return () => clearInterval(interval);
  }, [isRecording]);

  // Auto-scroll console
  useEffect(() => {
    if (activeTab === 'console' && !preserveLog) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleMessages, activeTab, preserveLog]);

  const clearConsole = () => {
    if (!preserveLog) {
      setConsoleMessages([]);
    }
  };

  const clearNetwork = () => {
    setNetworkRequests([]);
  };

  const filteredConsoleMessages = consoleMessages.filter(msg => {
    if (consoleFilter !== 'all' && msg.level !== consoleFilter) return false;
    if (searchQuery && !msg.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredNetworkRequests = networkRequests.filter(req => {
    if (networkFilter !== 'all' && !req.type.includes(networkFilter)) return false;
    if (searchQuery && !req.url.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const tabs = [
    { id: 'console', label: 'Console', icon: FiTerminal },
    { id: 'network', label: 'Network', icon: FiGlobe },
    { id: 'elements', label: 'Elements', icon: FiCode },
    { id: 'sources', label: 'Sources', icon: FiLayers },
    { id: 'performance', label: 'Performance', icon: FiActivity },
    { id: 'memory', label: 'Memory', icon: FiCpu },
    { id: 'application', label: 'Application', icon: FiDatabase },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'lighthouse', label: 'Lighthouse', icon: FiZap }
  ];

  // Level icon component
  const LevelIcon: React.FC<{ level: ConsoleMessage['level'] }> = ({ level }) => {
    switch (level) {
      case 'error':
        return <FiX className="text-red-400 w-4 h-4" />;
      case 'warn':
        return <FiAlertTriangle className="text-yellow-400 w-4 h-4" />;
      case 'info':
        return <FiInfo className="text-blue-400 w-4 h-4" />;
      case 'debug':
        return <FiTerminal className="text-gray-400 w-4 h-4" />;
      case 'trace':
        return <FiCode className="text-purple-400 w-4 h-4" />;
      default:
        return <div className="w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FiMonitor className="text-blue-400 w-5 h-5" />
            <h1 className="text-lg font-semibold">Developer Tools</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-10 pr-4 py-1.5 bg-gray-700 border border-gray-600 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => setPreserveLog(!preserveLog)}
              className={`p-1.5 rounded ${preserveLog ? 'bg-blue-600' : 'bg-gray-700'} hover:opacity-80`}
              title="Preserve log"
            >
              <FiClock className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`p-1.5 rounded ${isRecording ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80`}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <div className="w-3 h-3 rounded-full bg-white" />
            </button>
            <button
              onClick={() => window.location.reload()}
              className="p-1.5 bg-gray-700 rounded hover:bg-gray-600"
              title="Reload page"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-4 py-2 flex items-center space-x-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'text-blue-400 border-blue-400' 
                  : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'console' && (
          <div className="h-full flex flex-col">
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={clearConsole}
                  className="p-1.5 hover:bg-gray-700 rounded"
                  title="Clear console"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center space-x-1">
                  {(['all', 'log', 'info', 'warn', 'error', 'debug'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setConsoleFilter(level)}
                      className={`px-2 py-1 text-xs rounded ${
                        consoleFilter === level 
                          ? 'bg-gray-700 text-white' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-sm text-gray-400">
                {filteredConsoleMessages.length} messages
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-900 font-mono text-sm">
              {filteredConsoleMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`px-4 py-2 border-b border-gray-800 hover:bg-gray-800/50 ${
                    msg.level === 'error' ? 'bg-red-900/10' : 
                    msg.level === 'warn' ? 'bg-yellow-900/10' : ''
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <LevelIcon level={msg.level} />
                    <div className="flex-1">
                      <pre className="whitespace-pre-wrap break-all">{msg.message}</pre>
                      {msg.count > 1 && (
                        <span className="text-gray-500 text-xs ml-2">({msg.count})</span>
                      )}
                      {msg.stack && (
                        <pre className="text-xs text-gray-500 mt-2">{msg.stack}</pre>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs whitespace-nowrap">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="h-full flex">
            <div className="flex-1 flex flex-col">
              <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearNetwork}
                    className="p-1.5 hover:bg-gray-700 rounded"
                    title="Clear network"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center space-x-1">
                    {['all', 'fetch', 'xhr', 'js', 'css', 'img', 'font'].map(type => (
                      <button
                        key={type}
                        onClick={() => setNetworkFilter(type)}
                        className={`px-2 py-1 text-xs rounded ${
                          networkFilter === type 
                            ? 'bg-gray-700 text-white' 
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {filteredNetworkRequests.length} requests
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Method</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Initiator</th>
                      <th className="px-4 py-2 text-left">Size</th>
                      <th className="px-4 py-2 text-left">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNetworkRequests.map(req => (
                      <tr 
                        key={req.id} 
                        className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                        onClick={() => setSelectedNetworkRequest(req)}
                      >
                        <td className="px-4 py-2 truncate max-w-xs" title={req.url}>
                          {req.url.split('/').pop() || req.url}
                        </td>
                        <td className={`px-4 py-2 ${
                          req.status < 300 ? 'text-green-400' : 
                          req.status < 400 ? 'text-yellow-400' : 
                          'text-red-400'
                        }`}>
                          {req.status || 'Failed'}
                        </td>
                        <td className="px-4 py-2">{req.method}</td>
                        <td className="px-4 py-2">{req.type}</td>
                        <td className="px-4 py-2">{req.initiator}</td>
                        <td className="px-4 py-2">{req.size}B</td>
                        <td className="px-4 py-2">{req.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {selectedNetworkRequest && (
              <div className="w-96 bg-gray-800 border-l border-gray-700 p-4 overflow-auto">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Request Details</h3>
                  <button
                    onClick={() => setSelectedNetworkRequest(null)}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">General</h4>
                    <dl className="text-sm space-y-1">
                      <div>
                        <dt className="text-gray-400 inline">URL:</dt>
                        <dd className="inline ml-2">{selectedNetworkRequest.url}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400 inline">Method:</dt>
                        <dd className="inline ml-2">{selectedNetworkRequest.method}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400 inline">Status:</dt>
                        <dd className="inline ml-2">{selectedNetworkRequest.status}</dd>
                      </div>
                    </dl>
                  </div>
                  {selectedNetworkRequest.requestHeaders && (
                    <div>
                      <h4 className="font-medium mb-2">Request Headers</h4>
                      <pre className="text-xs bg-gray-900 p-2 rounded overflow-auto">
                        {JSON.stringify(selectedNetworkRequest.requestHeaders, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {performanceMetrics.map(metric => (
                <div key={metric.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-400">{metric.name}</div>
                  <div className="text-2xl font-semibold text-white">
                    {metric.value} {metric.unit}
                  </div>
                  {metric.description && (
                    <p className="text-xs text-gray-500 mt-1">{metric.description}</p>
                  )}
                </div>
              ))}
            </div>
            
            {resourceTimings.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Resource Timings</h3>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-2 text-left">Resource</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Duration</th>
                        <th className="px-4 py-2 text-left">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resourceTimings.slice(0, 20).map((timing, index) => (
                        <tr key={index} className="border-b border-gray-700">
                          <td className="px-4 py-2 truncate max-w-xs" title={timing.name}>
                            {timing.name.split('/').pop() || timing.name}
                          </td>
                          <td className="px-4 py-2">{timing.resourceType}</td>
                          <td className="px-4 py-2">{timing.duration.toFixed(2)}ms</td>
                          <td className="px-4 py-2">{timing.transferSize}B</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Other tabs placeholder */}
        {(activeTab === 'elements' || activeTab === 'sources' || activeTab === 'memory' || 
          activeTab === 'application' || activeTab === 'security' || activeTab === 'lighthouse') && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">The {activeTab} tab is not yet implemented</p>
              <p className="text-sm">This feature will be available in a future update</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevConsole;