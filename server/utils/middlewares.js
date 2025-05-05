/**
 * Server middleware functions
 */

import { access, error as logError } from './logger.js';
import { maskSensitiveInfo, createSafeError } from './security.js';

/**
 * Request logger middleware
 * Logs all incoming HTTP requests
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Add request ID for tracking requests across logs
  req.requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);
  
  // Override end method to calculate response time
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    access(req, res, responseTime);
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Error handler middleware
 * Catches all errors in the application and logs them
 */
export const errorHandler = (err, req, res, next) => {
  // Get status code from error or default to 500
  const statusCode = err.statusCode || 500;
  
  // Create a user-friendly error message
  const userMessage = err.userMessage || 'An unexpected error occurred';
  
  // Log the error with detailed information, but mask sensitive data
  const component = req.originalUrl ? req.originalUrl.split('/')[1]?.toUpperCase() || 'API' : 'API';
  const maskedErrorMessage = maskSensitiveInfo(err.message || 'Unknown error');
  
  // Log the error with request details
  logError(
    `Error handling request [${req.method} ${req.originalUrl}] from ${req.ip} - ${maskedErrorMessage}`,
    component,
    err
  );
  
  // Create a safe error response without sensitive data
  const safeError = createSafeError(err);
  
  // Send response to client
  res.status(statusCode).json({
    error: userMessage,
    requestId: req.requestId,
    status: statusCode,
    // Include additional details in development
    ...(process.env.NODE_ENV === 'development' && { details: safeError })
  });
};

/**
 * Not found middleware
 * Handles requests to non-existent routes
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: 'Resource not found',
    path: req.originalUrl,
    requestId: req.requestId
  });
};

/**
 * Request sanitization middleware
 * Sanitizes input data to prevent injection attacks
 */
export const sanitizeRequest = (req, res, next) => {
  // Basic sanitization
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Replace potentially dangerous characters
        req.body[key] = req.body[key]
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
    }
  }
  
  next();
};

// Using the maskSensitiveInfo function imported from security.js
// No need to redefine it here 