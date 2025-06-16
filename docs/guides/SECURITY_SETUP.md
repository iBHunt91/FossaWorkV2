# Security Setup Guide

## Overview

FossaWork V2 requires proper security configuration before deployment. This guide covers the essential security setup steps.

## Required Security Configuration

### 1. Environment Variables

FossaWork V2 requires two critical security keys to be set:

- **SECRET_KEY**: Used for JWT token signing and session security
- **FOSSAWORK_MASTER_KEY**: Used for encrypting stored credentials

**⚠️ CRITICAL**: These keys MUST be set before running the application. The application will fail to start without them.

### 2. Generate Secure Keys

#### Option A: Using the provided script

```bash
cd backend
python scripts/generate_secure_keys.py
```

This script will:
- Generate cryptographically secure keys
- Optionally create a `.env` file from `.env.example`
- Insert the generated keys automatically

#### Option B: Manual generation

Generate keys manually using Python:

```bash
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate FOSSAWORK_MASTER_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Then add them to your `backend/.env` file:

```env
SECRET_KEY="your-generated-secret-key-here"
FOSSAWORK_MASTER_KEY="your-generated-master-key-here"
```

### 3. Environment File Setup

1. Copy the example environment file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Update the `.env` file with:
   - Generated security keys (SECRET_KEY and FOSSAWORK_MASTER_KEY)
   - Database configuration
   - Email settings (if using email notifications)
   - Other service configurations

### 4. File Permissions

Ensure proper file permissions for sensitive files:

```bash
# Restrict .env file access (Unix/Linux/macOS)
chmod 600 backend/.env

# Credential storage directory
chmod 700 backend/data/credentials
```

## Security Best Practices

### Key Management

1. **Never commit keys to version control**
   - Add `.env` to `.gitignore` (already done)
   - Never hardcode keys in source code

2. **Use different keys for each environment**
   - Development keys
   - Staging keys
   - Production keys

3. **Rotate keys periodically**
   - Change keys every 3-6 months
   - Update all affected systems when rotating

### Credential Storage

- WorkFossa credentials are encrypted using the FOSSAWORK_MASTER_KEY
- Credentials are stored in `backend/data/credentials/`
- Each user's credentials are stored in a separate file
- Files have restricted permissions (owner read/write only)

### Authentication Flow

1. Users authenticate with WorkFossa credentials
2. Credentials are verified against WorkFossa's API
3. JWT tokens are issued for session management
4. Tokens expire after 24 hours (configurable)

## Production Deployment Checklist

Before deploying to production:

- [ ] Generate strong, unique security keys
- [ ] Set all required environment variables
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up firewall rules
- [ ] Configure CORS for your domain only
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerting
- [ ] Configure automated backups
- [ ] Review and restrict file permissions
- [ ] Disable debug mode (`DEBUG=false`)

## Troubleshooting

### "SECRET_KEY environment variable is not set" Error

This error occurs when the SECRET_KEY is missing from your environment:

1. Check if `.env` file exists in the backend directory
2. Verify SECRET_KEY is set in the `.env` file
3. Ensure the `.env` file is being loaded properly

### "FOSSAWORK_MASTER_KEY environment variable is not set" Error

This error occurs when trying to encrypt/decrypt credentials:

1. Check if FOSSAWORK_MASTER_KEY is set in `.env`
2. Restart the application after setting the key
3. Existing encrypted credentials may need to be re-encrypted

### Lost Keys

If you lose your keys:

1. **SECRET_KEY**: Generate a new one. All users will need to log in again.
2. **FOSSAWORK_MASTER_KEY**: Generate a new one. All stored credentials will need to be re-entered.

## Additional Security Resources

- [OWASP Security Guidelines](https://owasp.org/)
- [Python Security Best Practices](https://python.readthedocs.io/en/latest/library/secrets.html)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)