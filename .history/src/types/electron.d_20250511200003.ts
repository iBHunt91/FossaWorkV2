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
  // URL opening with auto-login
  openUrlWithLogin: (url: string, options?: { isDebugMode?: boolean }) => Promise<{ 
    success: boolean, 
    message?: string 
  }>;
  // URL opening with active user's credentials
  openUrlWithActiveUser: (options: { 
    url: string, 
    email: string, 
    password: string 
  }) => Promise<{ 
    success: boolean, 
    message?: string 
  }>;
  // File saving function
  saveFile: (options: {
    filename: string;
    content: string;
    path: string;
  }) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
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
    /**
     * Read a file from the filesystem as text
     * @param path Path to file
     * @param options Encoding options (default: 'utf8')
     * @returns Promise resolving to file contents as string
     */
    readFile: (path: string, options?: string) => Promise<string>;
    
    /**
     * Write a string to a file
     * @param path Path to file
     * @param data String content to write
     * @param options Encoding options (default: 'utf8')
     * @returns Promise resolving when write completes
     */
    writeFile: (path: string, data: string, options?: string) => Promise<void>;
    
    /**
     * Check if a file or directory exists
     * @param path Path to check
     * @returns Boolean indicating existence
     */
    exists: (path: string) => boolean;
    
    /**
     * Create a directory
     * @param path Directory to create
     * @param options Directory creation options
     * @returns Promise resolving when directory is created
     */
    mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
    
    /**
     * Get file stats
     * @param path Path to check
     * @returns Promise resolving to file stats object
     */
    stat: (path: string) => Promise<{
      isFile: () => boolean;
      isDirectory: () => boolean;
      size: number;
      mtime: Date;
    }>;
    
    /**
     * Join path segments
     * @param paths Path segments to join
     * @returns Joined path string
     */
    join: (...paths: string[]) => string;
    
    /**
     * Get directory name from path
     * @param path Path to process
     * @returns Directory portion of path
     */
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