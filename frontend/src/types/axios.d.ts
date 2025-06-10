/**
 * TypeScript declarations for Axios extensions
 */

import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}