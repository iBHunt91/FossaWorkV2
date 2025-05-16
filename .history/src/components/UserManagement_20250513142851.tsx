import React, { useState, useEffect } from 'react';
import { FiUser, FiPlus, FiEdit2, FiTrash2, FiCheckCircle, FiShield, FiFolder, FiCheck, FiX, FiUsers, FiLock, FiMail, FiClock } from 'react-icons/fi';
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mr-4">
            <FiUsers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Management</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage multiple users to keep work orders separate
            </p>
          </div>
        </div>
      </div>
      
      <div className="p-6 md:p-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <>
            {/* User List */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <span className="px-2.5 py-0.5 text-xs bg-primary-600 text-white rounded-full mr-3">
                    {users.length}
                  </span>
                  Users
                </h3>
                <button
                  onClick={() => setAddingUser(true)}
                  disabled={addingUser}
                  className="flex items-center text-sm px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg dark:bg-primary-600 dark:hover:bg-primary-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <FiPlus className="mr-2" /> Add User
                </button>
              </div>
              
              {users.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                  <div className="inline-flex h-16 w-16 rounded-full bg-primary-50 dark:bg-primary-900/20 items-center justify-center mb-4">
                    <FiUser className="h-8 w-8 text-primary-500 dark:text-primary-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users yet</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                    Add a user to get started with Fossa Monitor. Each user can have their own work orders and settings.
                  </p>
                  <button
                    onClick={() => setAddingUser(true)}
                    className="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <FiPlus className="mr-2" /> Add Your First User
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {users.map(user => (
                    <div 
                      key={user.id} 
                      className={`rounded-lg overflow-hidden shadow-md transition-all duration-200 ${
                        user.isActive 
                          ? 'bg-gradient-to-br from-primary-700 to-primary-800 text-white border border-primary-600' 
                          : 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-200 border border-gray-700 hover:border-gray-600 hover:translate-y-[-2px]'
                      }`}
                    >
                      {editingUser === user.id ? (
                        <div className="p-5">
                          <h4 className="text-sm font-medium text-gray-200 mb-3">Edit User Label</h4>
                          <div className="flex items-center">
                            <input
                              type="text"
                              value={newLabel}
                              onChange={(e) => setNewLabel(e.target.value)}
                              placeholder="Enter a label for this user"
                              className="flex-1 px-4 py-2.5 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-700 text-white shadow-inner"
                              autoFocus
                            />
                            <div className="flex ml-3">
                              <button
                                onClick={() => handleUpdateLabel(user.id)}
                                disabled={isSubmitting}
                                className="p-2.5 text-white bg-accent-green-600 hover:bg-accent-green-500 rounded-md transition-colors shadow-sm"
                                title="Save"
                              >
                                <FiCheck />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSubmitting}
                                className="p-2.5 text-white bg-gray-600 hover:bg-gray-500 rounded-md ml-2 transition-colors shadow-sm"
                                title="Cancel"
                              >
                                <FiX />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : renamingUser === user.id ? (
                        <div className="p-5">
                          <h4 className="text-sm font-medium text-gray-200 mb-3">Rename Directory</h4>
                          <div className="flex-1 mb-4">
                            <input
                              type="text"
                              value={friendlyName}
                              onChange={(e) => setFriendlyName(e.target.value)}
                              placeholder="Enter a friendly name for the directory"
                              className="w-full px-4 py-2.5 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-700 text-white shadow-inner"
                              autoFocus
                            />
                            <p className="text-xs text-gray-400 mt-2">
                              Only letters, numbers, underscores and hyphens are allowed
                            </p>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleRenameDirectory(user.id)}
                              disabled={isSubmitting || !friendlyName}
                              className="px-4 py-2 text-white bg-accent-green-600 hover:bg-accent-green-500 rounded-md transition-colors shadow-sm"
                            >
                              <FiCheck className="inline mr-1.5" /> Save
                            </button>
                            <button
                              onClick={handleCancelRename}
                              disabled={isSubmitting}
                              className="px-4 py-2 text-white bg-gray-600 hover:bg-gray-500 rounded-md ml-2 transition-colors shadow-sm"
                            >
                              <FiX className="inline mr-1.5" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-lg font-medium mr-4 shadow-md ${
                                user.isActive 
                                  ? 'bg-gradient-to-br from-primary-600 to-primary-800 text-primary-100' 
                                  : 'bg-gradient-to-br from-gray-600 to-gray-800 text-gray-300'
                              }`}>
                                {(user.label || user.email).charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-medium text-lg">
                                    {user.label || user.email.split('@')[0]}
                                  </h3>
                                  <div className="flex items-center">
                                    {user.id === 'tutorial' && (
                                      <span className="mr-2 text-xs px-2.5 py-1 bg-amber-700/50 text-amber-100 rounded-full flex items-center border border-amber-600/50 shadow-inner">
                                        Tutorial
                                      </span>
                                    )}
                                    {user.isActive && (
                                      <span className="text-xs px-2.5 py-1 bg-primary-700/50 text-primary-100 rounded-full flex items-center border border-primary-600/50 shadow-inner">
                                        <span className="w-1.5 h-1.5 bg-primary-400 rounded-full mr-1.5 animate-pulse"></span>
                                        Active
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-300 mt-1 flex items-center">
                                  <FiMail className="inline mr-1.5 text-gray-400" size={14} />
                                  {user.email}
                                </div>
                                <div className="text-xs text-gray-400 mt-1.5 flex items-center">
                                  <FiClock className="inline mr-1.5" size={12} />
                                  Last used: {new Date(user.lastUsed).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-t border-opacity-20 border-gray-600 bg-gray-800/60">
                            {!user.isActive ? (
                              <button
                                onClick={() => handleSetActiveUser(user.id)}
                                className="text-xs px-3.5 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-md transition-colors shadow-sm flex items-center"
                              >
                                <FiCheckCircle className="mr-1.5" /> Set Active
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleStartRename(user)}
                              className="text-xs px-3.5 py-1.5 bg-accent-purple-600 hover:bg-accent-purple-500 text-white rounded-md transition-colors shadow-sm flex items-center"
                            >
                              <FiFolder className="mr-1.5" /> Rename Directory
                            </button>
                            <button
                              onClick={() => handleStartEdit(user)}
                              className="text-xs px-3.5 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors shadow-sm flex items-center"
                            >
                              <FiEdit2 className="mr-1.5" /> Edit Label
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-xs px-3.5 py-1.5 bg-accent-red-600 hover:bg-accent-red-500 text-white rounded-md transition-colors shadow-sm flex items-center ml-auto"
                            >
                              <FiTrash2 className="mr-1.5" /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Add User Form */}
            {addingUser && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-800 overflow-hidden mt-8">
                <div className="bg-gradient-to-r from-primary-50 to-primary-50/30 dark:from-primary-900/20 dark:to-primary-900/5 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary-100 dark:bg-primary-800/50 flex items-center justify-center text-primary-600 dark:text-primary-400 mr-3">
                    <FiPlus className="h-4 w-4" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add New User</h3>
                </div>
                
                <div className="p-6">
                  <form onSubmit={handleAddUser} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <FiMail className="w-4 h-4 mr-1 text-gray-500 dark:text-gray-400" />
                          Work Fossa Email
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="Enter Work Fossa email"
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <FiLock className="mr-1 text-gray-500 dark:text-gray-400" />
                          Work Fossa Password
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder="Enter Work Fossa password"
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <FiUser className="mr-1 text-gray-500 dark:text-gray-400" />
                        User Label (Optional)
                      </label>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="E.g., Work, Personal, Tech 1, Tech 2"
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                        A friendly name to identify this user in the app
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800/50 -mx-6 -mb-6 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end items-center gap-3">
                      <button
                        type="button"
                        onClick={handleCancelAdd}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleVerifyCredentials}
                        disabled={isSubmitting || !email || !password}
                        className="px-4 py-2 text-sm font-medium text-white bg-accent-green-500 border border-transparent rounded-lg shadow-sm hover:bg-accent-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-green-500 disabled:opacity-50 dark:hover:bg-accent-green-500 flex items-center transition-colors"
                      >
                        <FiShield className="mr-2" />
                        Verify Only
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !email || !password}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-500 border border-transparent rounded-lg shadow-sm hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 dark:hover:bg-primary-500 transition-colors"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Verifying...
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <FiPlus className="mr-2" /> Add User
                          </span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UserManagement; 