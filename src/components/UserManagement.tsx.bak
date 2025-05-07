import React, { useState, useEffect } from 'react';
import { FiUser, FiPlus, FiEdit2, FiTrash2, FiCheckCircle, FiShield, FiFolder } from 'react-icons/fi';
import { getUsers, getActiveUser, setActiveUser, addUser, updateUserLabel, deleteUser, verifyCredentials, renameUserDirectory } from '../services/userService';
import { useToastNotification } from '../hooks/useToastNotification';
import { clearUserPageState } from '../hooks/usePageState';

interface User {
  id: string;
  email: string;
  label: string;
  lastUsed: string;
  isActive?: boolean;
  friendlyName?: string | null;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [activeUser, setActiveUserState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingUser, setAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [renamingUser, setRenamingUser] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [friendlyName, setFriendlyName] = useState('');
  
  const toast = useToastNotification();
  
  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);
  
  // Load users from the API
  const loadUsers = async () => {
    setLoading(true);
    try {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
      
      // Get active user
      const active = await getActiveUser();
      if (active) {
        setActiveUserState(active.id);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.showError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle active user change
  const handleSetActiveUser = async (userId: string) => {
    try {
      await setActiveUser(userId);
      setActiveUserState(userId);
      
      // Update isActive flag
      setUsers(prevUsers => 
        prevUsers.map(user => ({
          ...user,
          isActive: user.id === userId
        }))
      );
      
      // Store the active user ID in localStorage for persisted state
      localStorage.setItem('activeUserId', userId);
      
      // Dispatch a custom event to notify components about user change
      window.dispatchEvent(new CustomEvent('user-switched', {
        detail: { userId, previousUserId: activeUser }
      }));
      
      // Find the user for their label
      const user = users.find(u => u.id === userId);
      if (user) {
        localStorage.setItem('switchTargetLabel', user.label || user.email || 'Unknown User');
      }
      
      // Show success message
      toast.showSuccess('Active user changed successfully');
      
      // Reload the page to apply the new user context
      window.location.reload();
    } catch (error) {
      console.error('Error setting active user:', error);
      toast.showError('Failed to change active user');
    }
  };
  
  // Add a new user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // First verify the credentials
      const isValid = await verifyCredentials(email, password);
      
      if (!isValid) {
        toast.showError('Invalid Fossa credentials. Please check your email and password.');
        setIsSubmitting(false);
        return;
      }
      
      // Credentials are valid, proceed to add the user
      await addUser(email, password, label || undefined);
      
      // Reset form
      setEmail('');
      setPassword('');
      setLabel('');
      setAddingUser(false);
      
      // Reload users
      await loadUsers();
      
      // Show success message
      toast.showSuccess('User verified and added successfully');
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.showError(`Failed to add user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Update user label
  const handleUpdateLabel = async (userId: string) => {
    setIsSubmitting(true);
    
    try {
      await updateUserLabel(userId, newLabel);
      
      // Reset form
      setNewLabel('');
      setEditingUser(null);
      
      // Reload users
      await loadUsers();
      
      // Show success message
      toast.showSuccess('User label updated successfully');
    } catch (error) {
      console.error('Error updating user label:', error);
      toast.showError('Failed to update user label');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Delete user
  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This will permanently delete all data associated with this user.')) {
      return;
    }
    
    try {
      // Clear the user's persisted UI state before deleting them
      clearUserPageState(userId, 'both');
      
      // Then delete the user
      await deleteUser(userId);
      
      // Reload users
      await loadUsers();
      
      // Show success message
      toast.showSuccess('User deleted successfully');
      
      // If deleted user was active, reload the page
      if (userId === activeUser) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.showError('Failed to delete user');
    }
  };
  
  // Cancel adding user
  const handleCancelAdd = () => {
    setEmail('');
    setPassword('');
    setLabel('');
    setAddingUser(false);
  };
  
  // Cancel editing user
  const handleCancelEdit = () => {
    setNewLabel('');
    setEditingUser(null);
  };
  
  // Start editing a user
  const handleStartEdit = (user: User) => {
    setNewLabel(user.label);
    setEditingUser(user.id);
  };
  
  // Verify credentials without adding user
  const handleVerifyCredentials = async () => {
    if (!email || !password) {
      toast.showError('Please enter both email and password');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const isValid = await verifyCredentials(email, password);
      
      if (isValid) {
        toast.showSuccess('Credentials verified successfully');
      } else {
        toast.showError('Invalid Fossa credentials. Please check your email and password.');
      }
    } catch (error) {
      console.error('Error verifying credentials:', error);
      toast.showError('Failed to verify credentials');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Cancel renaming user
  const handleCancelRename = () => {
    setFriendlyName('');
    setRenamingUser(null);
  };
  
  // Start renaming a user directory
  const handleStartRename = (user: User) => {
    setFriendlyName(user.friendlyName || '');
    setRenamingUser(user.id);
  };
  
  // Rename user directory
  const handleRenameDirectory = async (userId: string) => {
    setIsSubmitting(true);
    
    try {
      await renameUserDirectory(userId, friendlyName);
      
      // Reset form
      setFriendlyName('');
      setRenamingUser(null);
      
      // Reload users
      await loadUsers();
      
      // Show success message
      toast.showSuccess('User directory renamed successfully');
    } catch (error: any) {
      console.error('Error renaming user directory:', error);
      toast.showError(`Failed to rename user directory: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center">
          <FiUser className="h-5 w-5 text-blue-500 mr-3" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage multiple users to keep work orders separate
        </p>
      </div>
      
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {/* User List */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-medium text-gray-900 dark:text-white">Users</h3>
                <button
                  onClick={() => setAddingUser(true)}
                  disabled={addingUser}
                  className="flex items-center text-sm px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                >
                  <FiPlus className="mr-1" /> Add User
                </button>
              </div>
              
              {users.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                  No users added yet. Add a user to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map(user => (
                    <div key={user.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      {editingUser === user.id ? (
                        <div className="flex items-center">
                          <input
                            type="text"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="Enter a label for this user"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <div className="flex ml-2">
                            <button
                              onClick={() => handleUpdateLabel(user.id)}
                              disabled={isSubmitting}
                              className="p-2 text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                            >
                              <FiCheckCircle />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={isSubmitting}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md ml-1"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      ) : renamingUser === user.id ? (
                        <div className="flex items-center">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Directory Name
                            </label>
                            <input
                              type="text"
                              value={friendlyName}
                              onChange={(e) => setFriendlyName(e.target.value)}
                              placeholder="Enter a friendly name for the directory"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Only letters, numbers, underscores and hyphens are allowed
                            </p>
                          </div>
                          <div className="flex ml-2">
                            <button
                              onClick={() => handleRenameDirectory(user.id)}
                              disabled={isSubmitting || !friendlyName}
                              className="p-2 text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                            >
                              <FiCheckCircle />
                            </button>
                            <button
                              onClick={handleCancelRename}
                              disabled={isSubmitting}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md ml-1"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center">
                              <span className="font-medium text-gray-900 dark:text-white">{user.label}</span>
                              {user.isActive && (
                                <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full dark:bg-green-900/30 dark:text-green-400">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {user.email}
                            </div>
                            {user.friendlyName && (
                              <div className="text-xs text-blue-500 dark:text-blue-400 mt-1 flex items-center">
                                <FiFolder className="inline mr-1" size={12} />
                                Directory: {user.friendlyName}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center">
                            {!user.isActive && (
                              <button
                                onClick={() => handleSetActiveUser(user.id)}
                                className="text-sm mr-2 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                              >
                                Set Active
                              </button>
                            )}
                            <button
                              onClick={() => handleStartRename(user)}
                              className="text-sm mr-2 px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30 transition-colors"
                              title="Rename Directory"
                            >
                              <FiFolder className="inline mr-1" /> Rename Directory
                            </button>
                            <button
                              onClick={() => handleStartEdit(user)}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                              title="Edit Label"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md ml-1"
                              title="Delete User"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Add User Form */}
            {addingUser && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-4">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-3">Add New User</h3>
                <form onSubmit={handleAddUser}>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Work Fossa Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Enter Work Fossa email"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Work Fossa Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter Work Fossa password"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      User Label (Optional)
                    </label>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="E.g., Work, Personal, Tech 1, Tech 2"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      A friendly name to identify this user
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleCancelAdd}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyCredentials}
                      disabled={isSubmitting || !email || !password}
                      className="ml-3 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 dark:hover:bg-green-500 flex items-center"
                    >
                      <FiShield className="mr-2" />
                      Verify Only
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !email || !password}
                      className="ml-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 dark:hover:bg-blue-500"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Verifying...
                        </span>
                      ) : (
                        'Add User'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UserManagement; 