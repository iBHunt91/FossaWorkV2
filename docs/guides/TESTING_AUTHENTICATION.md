# Testing the Authentication System

## 🔄 Reset to Zero-User State

Choose one of these methods:

### Option 1: Delete Database (Simplest)
```bash
# Windows
tools\reset-database.bat

# Linux/Mac
cd backend
rm fossawork.db
```

### Option 2: Python Script (If dependencies installed)
```bash
cd backend
python scripts/reset_users.py
```

## 🧪 Test the Authentication Flow

### 1. Start the Backend Server
```bash
cd backend
uvicorn app.main:app --reload
```

### 2. Verify Zero-User State
Visit: http://localhost:8000/api/setup/status

Expected response:
```json
{
  "setup_required": true,
  "user_count": 0,
  "message": "Please complete initial setup"
}
```

### 3. Test Initial Setup (First User)

#### Using API Docs (Easiest):
1. Visit http://localhost:8000/docs
2. Find `/api/setup/initialize`
3. Click "Try it out"
4. Enter your WorkFossa credentials:
   ```json
   {
     "username": "your@email.com",
     "password": "your_password"
   }
   ```
5. Click "Execute"

#### Using cURL:
```bash
curl -X POST http://localhost:8000/api/setup/initialize \
  -H "Content-Type: application/json" \
  -d '{"username": "your@email.com", "password": "your_password"}'
```

Expected response:
```json
{
  "success": true,
  "message": "System initialized successfully! You can now use the application.",
  "user_created": true,
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### 4. Test Regular Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your@email.com", "password": "your_password"}'
```

Expected response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "user_id": "7bea3bdb7e8e303eacaba442bd824004",
  "username": "your@email.com",
  "is_new_user": false
}
```

### 5. Test Protected Endpoints

#### Without Token (Should Fail):
```bash
curl http://localhost:8000/api/users
```

Expected: 401 Unauthorized
```json
{
  "detail": "Authentication required",
  "message": "Please provide a valid authentication token"
}
```

#### With Token (Should Succeed):
```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected: User information
```json
{
  "id": "7bea3bdb7e8e303eacaba442bd824004",
  "username": "your@email.com",
  "email": "your@email.com",
  "is_active": true,
  "created_at": "2024-01-15T12:00:00",
  "last_login": "2024-01-15T12:00:00"
}
```

## 📝 Test Scenarios

### Scenario 1: Fresh Install
1. Delete database
2. Start server
3. Verify setup required
4. Initialize with WorkFossa credentials
5. ✅ User created and logged in

### Scenario 2: Invalid Credentials
1. Try to initialize with wrong credentials
2. ❌ Should get "Invalid WorkFossa credentials" error

### Scenario 3: Second User
1. After first user exists
2. Try /api/setup/initialize
3. ❌ Should get "Setup already completed" error
4. Use /api/auth/login instead
5. ✅ New user created automatically

### Scenario 4: Token Expiration
1. Login and get token
2. Wait 24+ hours (or modify JWT_EXPIRATION_HOURS)
3. Try to use expired token
4. ❌ Should get "Invalid authentication token"

## 🔍 Debugging Tips

### Check Database State:
```python
# Quick Python script to check users
from app.database import SessionLocal
from app.models.user_models import User

db = SessionLocal()
users = db.query(User).all()
print(f"Users in database: {len(users)}")
for user in users:
    print(f"  - {user.username} (ID: {user.id})")
db.close()
```

### Test WorkFossa Verification:
```bash
curl -X POST http://localhost:8000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"username": "test@example.com", "password": "test"}'
```

### View Logs:
The server logs will show:
- `[VERIFY] Starting credential verification for user: xxx`
- `[VERIFY] Credentials verified successfully for user: xxx`
- `System initialized successfully with first user: xxx`

## 🎯 Success Criteria

✅ System starts with no users
✅ Setup endpoint only works when no users exist
✅ WorkFossa credentials are verified
✅ User profile created automatically
✅ JWT token returned for API access
✅ Protected endpoints require valid token
✅ Invalid credentials are rejected
✅ Tokens expire after 24 hours

## 🚀 Next Steps

After successful testing:
1. Update all routes to require authentication
2. Integrate with frontend login flow
3. Add remember me / refresh token support
4. Implement password reset via WorkFossa
5. Add rate limiting for security