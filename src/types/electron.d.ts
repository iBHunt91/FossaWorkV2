// ElectronAPI type definitions with missing methods added
interface ElectronAPI {
  // Add missing methods that were causing TypeScript errors
  saveFile(filePath: string, content: string): Promise<boolean>;
  openUrlWithActiveUser(options: {url: string, email: string, password: string}): Promise<any>;
}
