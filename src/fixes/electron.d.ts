// Add to your electron.d.ts file or create a new one

interface ElectronAPI {
  // Add existing methods here
  
  // Add these missing methods that are causing TS errors
  saveFile(filePath: string, content: string): Promise<boolean>;
  openUrlWithActiveUser(options: {url: string, email: string, password: string}): Promise<any>;
}
