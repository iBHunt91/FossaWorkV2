import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Settings, Menu, UserCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MobileNavigationProps {
  onMenuClick: () => void;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { path: '/profile', label: 'Profile', icon: UserCircle },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-area-bottom z-50 sm:hidden">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 px-2 py-2",
                "text-xs font-medium transition-colors",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
                "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "text-blue-600 dark:text-blue-400")} />
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
        
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center space-y-1 px-2 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        >
          <Menu className="w-5 h-5" />
          <span className="text-xs font-medium">Menu</span>
        </button>
      </div>
    </nav>
  );
};