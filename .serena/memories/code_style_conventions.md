# FossaWork V2 Code Style and Conventions

## Python Code Style (Backend)

### General Guidelines
- **Style Guide:** PEP 8 with Black formatting (88 char line length)
- **Import Sorting:** isort with Black profile
- **Type Hints:** Use type hints for all function parameters and returns
- **Docstrings:** Use docstrings for all public functions and classes

### Naming Conventions
- **Files:** lowercase with underscores (e.g., `user_management.py`)
- **Classes:** PascalCase (e.g., `UserManagementService`)
- **Functions/Variables:** snake_case (e.g., `get_user_by_id`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `DATABASE_URL`)
- **Private:** Prefix with underscore (e.g., `_internal_method`)

### Code Structure
```python
# Imports grouped: stdlib, third-party, local
import os
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.services.user_management import UserManagementService
from app.core.logging import logger

# Constants
DEFAULT_TIMEOUT = 30

# Classes with type hints and docstrings
class UserCreate(BaseModel):
    """Schema for creating a new user."""
    email: str
    password: str
    display_name: Optional[str] = None

# Functions with type hints
async def create_user(user_data: UserCreate) -> dict:
    """Create a new user with the provided data."""
    try:
        result = await user_service.create_user(user_data)
        return result
    except Exception as e:
        logger.error(f"Failed to create user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

## TypeScript/React Code Style (Frontend)

### General Guidelines
- **Style Guide:** Airbnb React/JSX Style Guide
- **Formatting:** Prettier with default settings
- **TypeScript:** Strict mode enabled
- **Components:** Functional components with hooks

### Naming Conventions
- **Files:** kebab-case for regular files, PascalCase for components
- **Components:** PascalCase (e.g., `UserDashboard.tsx`)
- **Functions/Variables:** camelCase (e.g., `getUserData`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Types/Interfaces:** PascalCase with 'I' prefix for interfaces

### Component Structure
```typescript
// Imports grouped: React, third-party, local, types
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import type { IUser } from '@/types/user';

// Interface definitions
interface IUserCardProps {
  user: IUser;
  onEdit?: (userId: string) => void;
}

// Functional component with typed props
export const UserCard: React.FC<IUserCardProps> = ({ user, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);

  // Custom hooks and queries
  const { data, isLoading } = useQuery({
    queryKey: ['user', user.id],
    queryFn: () => api.getUser(user.id),
  });

  // Event handlers
  const handleEdit = () => {
    setIsEditing(true);
    onEdit?.(user.id);
  };

  // Render
  return (
    <div className="p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold">{user.name}</h3>
      <Button onClick={handleEdit}>Edit</Button>
    </div>
  );
};
```

## API Design Patterns

### RESTful Endpoints
```
GET    /api/v1/resources          # List all
GET    /api/v1/resources/{id}     # Get one
POST   /api/v1/resources          # Create
PUT    /api/v1/resources/{id}     # Update
DELETE /api/v1/resources/{id}     # Delete
```

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2025-01-13T10:00:00Z"
}
```

### Error Format
```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid credentials",
    "details": { ... }
  }
}
```

## File Organization
- Test files go in `/tests/` subdirectories, never in source directories
- Use kebab-case for filenames (except React components)
- Group related files in feature-based directories
- Keep files focused and under 500 lines when possible

## Security Practices
- Never log sensitive information (passwords, tokens, keys)
- Always validate and sanitize user inputs
- Use parameterized queries for database operations
- Implement proper error handling without exposing internals
- Use environment variables for configuration

## Documentation
- Write clear, concise comments for complex logic
- Update documentation when changing functionality
- Include examples in docstrings where helpful
- Maintain README files in major directories