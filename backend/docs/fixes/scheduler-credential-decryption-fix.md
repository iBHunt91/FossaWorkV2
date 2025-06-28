# Scheduler Credential Decryption Fix

## Issue
The WorkFossa credentials were not decrypting properly in the scheduler service. The error message showed:
```
Decryption failed, treating as plain text:
```

## Root Cause
The scheduler was trying to retrieve credentials from the database using the `UserCredential` model and `encryption_service.py`, but the application had migrated to using a file-based `credential_manager.py` system. The database contained old encrypted values that were encrypted with a different key/system, causing decryption failures.

## Solution

### 1. Updated Scheduler Service
Modified `/backend/app/services/scheduler_service.py` to use the `credential_manager` instead of querying the database directly:

```python
# OLD CODE (removed):
from ..models.user_models import UserCredential
from ..services.encryption_service import decrypt_string

db = SessionLocal()
try:
    user_credential = db.query(UserCredential).filter(
        UserCredential.user_id == user_id,
        UserCredential.service_name == 'workfossa'
    ).first()
    
    # Decrypt credentials directly
    username = decrypt_string(user_credential.encrypted_username)
    password = decrypt_string(user_credential.encrypted_password)

# NEW CODE:
from ..services.credential_manager import credential_manager

# Ensure FOSSAWORK_MASTER_KEY is loaded from .env
if not os.environ.get('FOSSAWORK_MASTER_KEY'):
    env_path = Path(__file__).parent.parent.parent / '.env'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('FOSSAWORK_MASTER_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"\'')
                    os.environ['FOSSAWORK_MASTER_KEY'] = key
                    break

# Retrieve credentials using credential manager
secure_credentials = credential_manager.retrieve_credentials(user_id)
username = secure_credentials.username
password = secure_credentials.password

# Update last used timestamp
credential_manager.update_last_used(user_id)
```

### 2. Cleaned Up Old Database Entries
Removed old credential entries from the database that were causing confusion. The application now exclusively uses the file-based credential manager located at `/backend/data/credentials/`.

### 3. Credential Storage Architecture
The application uses two different encryption systems:
- **Database encryption** (`encryption_service.py`): Uses SECRET_KEY from .env
- **File-based credential storage** (`credential_manager.py`): Uses FOSSAWORK_MASTER_KEY from .env

Credentials are stored as encrypted JSON files in `/backend/data/credentials/{user_id}.cred`.

## Verification
Created test scripts to verify the fix:
- `test_scheduler_credential_fix.py`: Tests basic credential retrieval
- `test_scheduler_final_verification.py`: Complete end-to-end verification
- `cleanup_old_db_credentials_auto.py`: Removes old database entries

## Result
✅ Scheduler can now properly retrieve WorkFossa credentials without decryption errors
✅ Old database entries have been cleaned up
✅ Credential manager is properly configured with correct master key
✅ The scheduler job execution should work without authentication issues