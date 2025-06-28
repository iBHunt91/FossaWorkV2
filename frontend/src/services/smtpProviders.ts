/**
 * SMTP Provider Detection Service
 * 
 * Automatically detects SMTP server settings based on email domain.
 * Includes configurations for common email providers.
 */

export interface SMTPProviderConfig {
  name: string;
  smtp_server: string;
  smtp_port: number;
  use_tls: boolean;
  use_ssl: boolean;
  notes?: string;
  oauth?: boolean; // Some providers require OAuth instead of password
}

// Common SMTP provider configurations
export const SMTP_PROVIDERS: Record<string, SMTPProviderConfig> = {
  // Google (Gmail, Google Workspace)
  'gmail.com': {
    name: 'Gmail',
    smtp_server: 'smtp.gmail.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires an App Password. Enable 2FA and generate an app-specific password at https://myaccount.google.com/apppasswords',
    oauth: true
  },
  'googlemail.com': {
    name: 'Gmail',
    smtp_server: 'smtp.gmail.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires an App Password. Enable 2FA and generate an app-specific password.',
    oauth: true
  },
  
  // Microsoft (Outlook, Hotmail, Live)
  'outlook.com': {
    name: 'Outlook.com',
    smtp_server: 'smtp-mail.outlook.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'May require an app password if 2FA is enabled.'
  },
  'hotmail.com': {
    name: 'Hotmail',
    smtp_server: 'smtp-mail.outlook.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'May require an app password if 2FA is enabled.'
  },
  'live.com': {
    name: 'Live.com',
    smtp_server: 'smtp-mail.outlook.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'May require an app password if 2FA is enabled.'
  },
  'msn.com': {
    name: 'MSN',
    smtp_server: 'smtp-mail.outlook.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  
  // Yahoo
  'yahoo.com': {
    name: 'Yahoo Mail',
    smtp_server: 'smtp.mail.yahoo.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires an App Password. Generate one at https://login.yahoo.com/account/security',
    oauth: true
  },
  'ymail.com': {
    name: 'Yahoo Mail',
    smtp_server: 'smtp.mail.yahoo.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires an App Password.',
    oauth: true
  },
  
  // Apple iCloud
  'icloud.com': {
    name: 'iCloud Mail',
    smtp_server: 'smtp.mail.me.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires an app-specific password. Generate at https://appleid.apple.com'
  },
  'me.com': {
    name: 'iCloud Mail',
    smtp_server: 'smtp.mail.me.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires an app-specific password.'
  },
  'mac.com': {
    name: 'iCloud Mail',
    smtp_server: 'smtp.mail.me.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires an app-specific password.'
  },
  
  // AOL
  'aol.com': {
    name: 'AOL Mail',
    smtp_server: 'smtp.aol.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'May require an app password.'
  },
  'aim.com': {
    name: 'AIM Mail',
    smtp_server: 'smtp.aol.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  
  // ProtonMail
  'protonmail.com': {
    name: 'ProtonMail',
    smtp_server: 'smtp.protonmail.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires ProtonMail Bridge application. Download from https://protonmail.com/bridge'
  },
  'proton.me': {
    name: 'Proton Mail',
    smtp_server: 'smtp.protonmail.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires ProtonMail Bridge application.'
  },
  
  // Zoho
  'zoho.com': {
    name: 'Zoho Mail',
    smtp_server: 'smtp.zoho.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  'zohomail.com': {
    name: 'Zoho Mail',
    smtp_server: 'smtp.zoho.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  
  // FastMail
  'fastmail.com': {
    name: 'FastMail',
    smtp_server: 'smtp.fastmail.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires an app-specific password.'
  },
  'fastmail.fm': {
    name: 'FastMail',
    smtp_server: 'smtp.fastmail.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires an app-specific password.'
  },
  
  // Mail.com
  'mail.com': {
    name: 'Mail.com',
    smtp_server: 'smtp.mail.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  
  // GMX
  'gmx.com': {
    name: 'GMX Mail',
    smtp_server: 'smtp.gmx.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  'gmx.net': {
    name: 'GMX Mail',
    smtp_server: 'smtp.gmx.net',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  
  // Yandex
  'yandex.com': {
    name: 'Yandex Mail',
    smtp_server: 'smtp.yandex.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  'yandex.ru': {
    name: 'Yandex Mail',
    smtp_server: 'smtp.yandex.ru',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  
  // Mail.ru
  'mail.ru': {
    name: 'Mail.ru',
    smtp_server: 'smtp.mail.ru',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'May require app password for external clients.'
  },
  
  // Comcast
  'comcast.net': {
    name: 'Comcast',
    smtp_server: 'smtp.comcast.net',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  'xfinity.com': {
    name: 'Xfinity',
    smtp_server: 'smtp.comcast.net',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  
  // AT&T
  'att.net': {
    name: 'AT&T',
    smtp_server: 'smtp.mail.att.net',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires a secure mail key instead of password.'
  },
  'sbcglobal.net': {
    name: 'AT&T (SBCGlobal)',
    smtp_server: 'smtp.mail.att.net',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'Requires a secure mail key instead of password.'
  },
  
  // Verizon
  'verizon.net': {
    name: 'Verizon',
    smtp_server: 'smtp.verizon.net',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false
  },
  
  // Office 365 (Business)
  'office365.com': {
    name: 'Office 365',
    smtp_server: 'smtp.office365.com',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
    notes: 'For business accounts. May require admin approval for SMTP.'
  }
};

/**
 * Detects SMTP configuration based on email address
 * @param email The email address to detect SMTP settings for
 * @returns SMTP configuration if found, null otherwise
 */
export function detectSMTPProvider(email: string): SMTPProviderConfig | null {
  if (!email || !email.includes('@')) {
    return null;
  }
  
  const domain = email.toLowerCase().split('@')[1];
  
  // Direct domain match
  if (SMTP_PROVIDERS[domain]) {
    return SMTP_PROVIDERS[domain];
  }
  
  // Check for custom/business domains using common providers
  // Many businesses use Google Workspace or Office 365
  if (domain && !SMTP_PROVIDERS[domain]) {
    // Return a generic suggestion for custom domains
    return {
      name: 'Custom Domain',
      smtp_server: '',
      smtp_port: 587,
      use_tls: true,
      use_ssl: false,
      notes: `Unable to auto-detect SMTP settings for ${domain}. Common options:\n` +
             `• Google Workspace: smtp.gmail.com (port 587)\n` +
             `• Office 365: smtp.office365.com (port 587)\n` +
             `• Contact your IT administrator or email provider for correct settings.`
    };
  }
  
  return null;
}

/**
 * Gets a list of all supported email providers
 * @returns Array of provider domains and names
 */
export function getSupportedProviders(): Array<{ domain: string; name: string }> {
  return Object.entries(SMTP_PROVIDERS).map(([domain, config]) => ({
    domain,
    name: config.name
  }));
}

/**
 * Validates if SMTP settings are complete
 * @param settings The SMTP settings to validate
 * @returns True if settings are complete and valid
 */
export function validateSMTPSettings(settings: Partial<SMTPProviderConfig>): boolean {
  return !!(
    settings.smtp_server &&
    settings.smtp_port &&
    settings.smtp_port > 0 &&
    settings.smtp_port <= 65535
  );
}