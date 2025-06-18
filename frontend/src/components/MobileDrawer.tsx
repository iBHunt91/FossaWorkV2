import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Activity, FileText, Users, Wrench, Bell, LogOut, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface DrawerItem {
  path?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: () => void;
  divider?: boolean;
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const drawerItems: DrawerItem[] = [
    { path: '/dispensers', label: 'Dispensers', icon: Activity },
    { path: '/batch-processor', label: 'Batch Processor', icon: FileText },
    { path: '/queue-manager', label: 'Queue Manager', icon: Wrench },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { divider: true, label: '', icon: ChevronRight },
    { path: '/users', label: 'User Management', icon: Users },
    { divider: true, label: '', icon: ChevronRight },
    {
      label: 'Logout',
      icon: LogOut,
      action: () => {
        logout();
        navigate('/login');
        onClose();
      },
    },
  ];

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleItemClick = (item: DrawerItem) => {
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 sm:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-gray-900",
          "shadow-2xl z-[70] transform transition-transform duration-300 ease-out sm:hidden",
          "flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Menu</h2>
            {user && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{user.username}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-4">
          {drawerItems.map((item, index) => {
            const Icon = item.icon;

            if (item.divider) {
              return (
                <div key={index} className="my-2 px-4">
                  <hr className="border-gray-200 dark:border-gray-800" />
                </div>
              );
            }

            return (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3",
                  "text-left transition-colors",
                  "hover:bg-gray-50 dark:hover:bg-gray-800",
                  "focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-800",
                  item.action === logout && "text-red-600 dark:text-red-400"
                )}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.path && <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            FossaWork v2.0
          </p>
        </div>
      </div>
    </>
  );
};