/**
 * Utility for safely handling API error responses
 */

export interface ValidationError {
  type: string;
  loc: string[];
  msg: string;
  input?: any;
  ctx?: any;
}

export interface APIError {
  detail?: string | ValidationError[];
  message?: string;
  error?: string;
}

/**
 * Extract a user-friendly error message from an API error response
 */
export function getErrorMessage(error: any): string {
  // Handle axios error structure
  if (error.response?.data) {
    return extractErrorMessage(error.response.data);
  }
  
  // Handle direct error object
  if (error.detail || error.message || error.error) {
    return extractErrorMessage(error);
  }
  
  // Handle Error instance
  if (error instanceof Error) {
    return error.message;
  }
  
  // Fallback
  return typeof error === 'string' ? error : 'An unexpected error occurred';
}

/**
 * Extract error message from API error data
 */
function extractErrorMessage(data: APIError): string {
  // Handle FastAPI validation errors
  if (Array.isArray(data.detail)) {
    const validationErrors = data.detail as ValidationError[];
    const messages = validationErrors.map(err => {
      // Format validation error message
      const field = err.loc.length > 0 ? err.loc[err.loc.length - 1] : 'field';
      return `${field}: ${err.msg}`;
    });
    return messages.join(', ');
  }
  
  // Handle string detail
  if (typeof data.detail === 'string') {
    return data.detail;
  }
  
  // Handle other error formats
  if (data.message) {
    return data.message;
  }
  
  if (data.error) {
    return data.error;
  }
  
  // Fallback
  return 'An error occurred';
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: any): boolean {
  if (error.response?.data?.detail && Array.isArray(error.response.data.detail)) {
    return error.response.data.detail.every((item: any) => 
      item.type && item.loc && item.msg
    );
  }
  return false;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): Record<string, string> {
  const formatted: Record<string, string> = {};
  
  errors.forEach(error => {
    const field = error.loc.length > 0 ? error.loc[error.loc.length - 1] : 'general';
    formatted[field] = error.msg;
  });
  
  return formatted;
}