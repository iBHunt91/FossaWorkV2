import { buildUrl } from '../config/api';

interface User {
  id: string;
  email: string;
  label: string;
  lastUsed: string;
  isActive?: boolean;
}

interface UserResponse {
  success: boolean;
  message?: string;
  users?: User[];
  user?: User;
  userId?: string;
}

/**
 * Fetch all users
 */
export const getUsers = async (): Promise<User[]> => {
  try {
    const url = await buildUrl('/api/users');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success || !data.users) {
      throw new Error(data.message || 'Failed to fetch users');
    }
    
    return data.users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

/**
 * Get active user
 */
export const getActiveUser = async (): Promise<User | null> => {
  console.log('\n=== START: getActiveUser API Call ===');
  try {
    const url = await buildUrl('/api/users/active');
    console.log('Making GET request to:', url);
    
    const response = await fetch(url);
    console.log('Server response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    console.log('Server response data:', data);
    
    if (!data.success) {
      console.error('Server returned unsuccessful response:', data);
      throw new Error(data.message || 'Failed to fetch active user');
    }
    
    console.log('=== END: getActiveUser API Call - Success ===\n');
    return data.user || null;
  } catch (error) {
    console.error('\n=== ERROR: getActiveUser API Call Failed ===');
    console.error('Error details:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    console.error('=== End Error Log ===\n');
    throw error;
  }
};

/**
 * Set active user
 */
export const setActiveUser = async (userId: string): Promise<User> => {
  console.log('\n=== START: setActiveUser API Call ===');
  try {
    console.log('Setting active user to:', userId);
    const url = await buildUrl('/api/users/active');
    console.log('Making POST request to:', url);
    console.log('Request body:', { userId });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    console.log('Server response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    console.log('Server response data:', data);
    
    if (!data.success || !data.user) {
      console.error('Server returned unsuccessful response:', data);
      throw new Error(data.message || 'Failed to set active user');
    }
    
    console.log('=== END: setActiveUser API Call - Success ===\n');
    return data.user;
  } catch (error) {
    console.error('\n=== ERROR: setActiveUser API Call Failed ===');
    console.error('Error details:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    console.error('=== End Error Log ===\n');
    throw error;
  }
};

/**
 * Add or update user
 */
export const addUser = async (email: string, password: string, label?: string): Promise<string> => {
  try {
    const url = await buildUrl('/api/users');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, label })
    });
    
    if (!response.ok) {
      // Try to parse error message
      const errorData = await response.json();
      throw new Error(errorData.message || `Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success || !data.userId) {
      throw new Error(data.message || 'Failed to add user');
    }
    
    return data.userId;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
};

/**
 * Update user label
 */
export const updateUserLabel = async (userId: string, label: string): Promise<void> => {
  try {
    const url = await buildUrl(`/api/users/${userId}`);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ label })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to update user label');
    }
  } catch (error) {
    console.error('Error updating user label:', error);
    throw error;
  }
};

/**
 * Delete user
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const url = await buildUrl(`/api/users/${userId}`);
    const response = await fetch(url, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete user');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Verify Fossa credentials without creating a user
 */
export const verifyCredentials = async (email: string, password: string): Promise<boolean> => {
  try {
    const url = await buildUrl('/api/users/verify-credentials');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data: UserResponse = await response.json();
    
    // Return true if success, false if invalid credentials
    return data.success;
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return false;
  }
};

/**
 * Rename a user directory with a friendly name
 */
export const renameUserDirectory = async (userId: string, friendlyName: string): Promise<boolean> => {
  try {
    const url = await buildUrl('/api/users/rename');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, friendlyName })
    });
    
    if (!response.ok) {
      // Try to parse error message
      const errorData = await response.json();
      throw new Error(errorData.message || `Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to rename user directory');
    }
    
    return true;
  } catch (error) {
    console.error('Error renaming user directory:', error);
    throw error;
  }
};

/**
 * Get users with friendly names
 */
export const getUserFriendlyNames = async (): Promise<any[]> => {
  try {
    const url = await buildUrl('/api/users/friendly-names');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.users) {
      throw new Error(data.message || 'Failed to fetch user friendly names');
    }
    
    return data.users;
  } catch (error) {
    console.error('Error fetching user friendly names:', error);
    throw error;
  }
}; 