// TypeScript definitions for Electron IPC API
// Define the Prover interface
interface Prover {
  prover_id: string;
  serial: string;
  make: string;
  preferred_fuel_type: string;
  preferred_fuel_types?: string[]; // Array of fuel types for multi-select
  priority?: number; // 1, 2, 3 for priority ranking
}

// Define the ProverPreferencesData interface
interface ProverPreferencesData {
  provers: Prover[];
  last_updated: string;
}

export interface ElectronAPI {
  getServerPort: () => Promise<number>;
  updateFossaCredentials: (email: string, password: string) => Promise<{ success: boolean, message: string }>;
  testFossaCredentials: (email: string, password: string) => Promise<{ success: boolean, message: string }>;
  testScheduleChange: (options: {
    changeType: 'add' | 'remove' | 'replace' | 'date' | 'swap';
    count: number;
    preferences?: {
      useEmailPreferences?: boolean;
      usePushoverPreferences?: boolean;
      forceShowAllFields?: boolean;
    };
  }) => Promise<{
    success: boolean;
    message: string;
    results?: any;
  }>;
  testAlertService: (options: { alertType: 'battery' | 'connectivity' | 'error', severity: 'critical' | 'high' | 'normal', count: number }) => Promise<{ success: boolean, message?: string }>;
  // Prover preferences handlers
  getProverPreferences: () => Promise<ProverPreferencesData>;
  updateProverPreferences: (data: ProverPreferencesData) => Promise<{ 
    success: boolean, 
    data?: ProverPreferencesData, 
    error?: string
  }>;
  scrapeProverInfo: () => Promise<{
    success: boolean,
    error?: string
  }>;
  // Application reload function
  reloadApp: () => Promise<{
    success: boolean,
    error?: string
  }>;
  fs: {
    readFile: (path: string, options?: string) => Promise<string>;
    writeFile: (path: string, data: string, options?: string) => Promise<void>;
    exists: (path: string) => boolean;
    mkdir: (path: string, options?: any) => Promise<void>;
    stat: (path: string) => Promise<any>;
    join: (...paths: string[]) => string;
    dirname: (path: string) => string;
  };
  onNavigate: (callback: (route: string) => void) => void;
  onTestNotificationResult: (callback: (result: any) => void) => void;
  onBackendStatus: (callback: (status: any) => void) => void;
  onBackendError: (callback: (error: any) => void) => void;
  // Automatic scrape handler
  onScrapeComplete: (callback: (data: { type: string; timestamp: string; success: boolean }) => void) => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export { Prover, ProverPreferencesData }; 