/**
 * Security utilities for masking sensitive information
 */

// List of environment variable names considered sensitive
const SENSITIVE_ENV_VARS = [
  'PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL', 'API_KEY', 'AUTH',
  'PRIVATE', 'CERT', 'FOSSA_PASSWORD', 'FOSSA_EMAIL', 'PUSHOVER_TOKEN',
  'SMTP_PASSWORD', 'EMAIL_PASSWORD', 'PASS'
];

/**
 * Mask an email address for logging/display
 * Preserves the first character and domain, masks everything else
 * 
 * @param {string} email - Email address to mask
 * @returns {string} - Masked email (e.g., j***@example.com)
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '[invalid email]';
  
  try {
    const atIndex = email.indexOf('@');
    if (atIndex <= 0) return '[invalid email format]';
    
    const localPart = email.slice(0, atIndex);
    const domainPart = email.slice(atIndex);
    
    // Keep first character of local part, mask the rest
    const firstChar = localPart.charAt(0);
    const maskedLocalPart = firstChar + '*'.repeat(Math.min(localPart.length - 1, 3));
    
    return maskedLocalPart + domainPart;
  } catch (err) {
    return '[email masking error]';
  }
};

/**
 * Check if an environment variable name is considered sensitive
 * 
 * @param {string} name - Environment variable name
 * @returns {boolean} - Whether the variable is sensitive
 */
export const isSensitiveEnvVar = (name) => {
  if (!name || typeof name !== 'string') return false;
  
  const upperName = name.toUpperCase();
  return SENSITIVE_ENV_VARS.some(pattern => {
    return upperName.includes(pattern);
  });
};

/**
 * Mask sensitive environment variables
 * Replace the value with [REDACTED] for sensitive variables
 * 
 * @param {Object} env - Environment variables object
 * @returns {Object} - Copied and masked environment variables
 */
export const maskSensitiveEnv = (env = {}) => {
  const maskedEnv = { ...env };
  
  for (const key in maskedEnv) {
    if (isSensitiveEnvVar(key)) {
      maskedEnv[key] = '[REDACTED]';
    } else if (key.toUpperCase().includes('EMAIL') && typeof maskedEnv[key] === 'string') {
      // Mask email addresses
      maskedEnv[key] = maskEmail(maskedEnv[key]);
    }
  }
  
  return maskedEnv;
};

/**
 * Mask sensitive information in error messages and logs
 * 
 * @param {string} message - Message that might contain sensitive information
 * @returns {string} - Message with sensitive information masked
 */
export const maskSensitiveInfo = (message) => {
  if (!message || typeof message !== 'string') return message;
  
  let maskedMessage = message;
  
  // Mask email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  maskedMessage = maskedMessage.replace(emailRegex, (match) => maskEmail(match));
  
  // Mask passwords in clear text
  const passwordRegex = /password[=:]\s*['"]?([^'"&\s]+)['"]?/gi;
  maskedMessage = maskedMessage.replace(passwordRegex, 'password=[REDACTED]');
  
  // Mask API keys
  const apiKeyRegex = /api[_-]?key[=:]\s*['"]?([^'"&\s]+)['"]?/gi;
  maskedMessage = maskedMessage.replace(apiKeyRegex, 'api_key=[REDACTED]');
  
  // Mask tokens
  const tokenRegex = /token[=:]\s*['"]?([^'"&\s]+)['"]?/gi;
  maskedMessage = maskedMessage.replace(tokenRegex, 'token=[REDACTED]');
  
  // Mask anything labeled secret
  const secretRegex = /secret[=:]\s*['"]?([^'"&\s]+)['"]?/gi;
  maskedMessage = maskedMessage.replace(secretRegex, 'secret=[REDACTED]');
  
  return maskedMessage;
};

/**
 * Safe error handler that doesn't expose sensitive information
 * 
 * @param {Error} error - Original error object
 * @returns {Object} - Safe error object with masked information
 */
export const createSafeError = (error) => {
  const safeError = {
    message: maskSensitiveInfo(error.message || 'Unknown error'),
    code: error.code || 'UNKNOWN_ERROR',
    status: error.status || 500
  };
  
  // Add sanitized stack trace in development only
  if (process.env.NODE_ENV === 'development' && error.stack) {
    safeError.stack = maskSensitiveInfo(error.stack);
  }
  
  return safeError;
}; 