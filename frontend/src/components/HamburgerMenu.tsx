import React from 'react';
import { Menu } from 'lucide-react';
import { cn } from '../lib/utils';

interface HamburgerMenuProps {
  onClick: () => void;
  className?: string;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ onClick, className }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-2 rounded-lg transition-colors sm:hidden",
        "hover:bg-gray-100 dark:hover:bg-gray-800",
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        className
      )}
      aria-label="Open menu"
    >
      <Menu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
    </button>
  );
};