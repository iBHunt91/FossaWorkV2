import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  description?: string;
  icon?: React.ElementType;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  description,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
  className
}) => {
  return (
    <div className={cn("rounded-lg border border-border bg-card overflow-hidden transition-all", className)}>
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
          <div className="text-left">
            <h3 className="font-medium text-base">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground transition-transform" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-6 pb-6 pt-2 border-t border-border/50 animate-slide-in-from-top">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;