import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  FiCalendar,
  FiClock,
  FiFileText,
  FiMapPin,
  FiMoreHorizontal,
  FiPhone,
  FiUser,
  FiExternalLink,
  FiTrash2,
  FiRefreshCw,
  FiStar,
  FiInfo // Added for instructions button
} from "react-icons/fi";
import { GiGasPump } from "react-icons/gi"; // Using GiGasPump for dispensers
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge"; // Status badge commented out for now

// Import types and helpers from Schedule page (adjust path if necessary)
import {
  type WorkOrder,
  // type Dispenser, // Dispenser type is part of WorkOrder
  getStoreStyles,
  getStoreTypeForFiltering,
  extractVisitNumber,
  processInstructions,
} from "../pages/Schedule"; // Assuming Schedule.tsx is in src/pages

// Define card variants based on store colors using getStoreStyles
// This cva might be simplified or replaced if getStoreStyles handles all necessary classes
const jobCardVariants = cva("relative overflow-hidden transition-all group", {
  variants: {
    storeTypeName: {
      default: "border-l-4 border-slate-500", // Fallback
      "7-eleven": "border-l-4 border-green-500",
      "circle-k": "border-l-4 border-red-500",
      wawa: "border-l-4 border-purple-500",
      other: "border-l-4 border-blue-500",
    },
  },
  defaultVariants: {
    storeTypeName: "default",
  },
});

// Define info pill variants for key information - will use these with distinct colors
const infoPillVariants = cva(
  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      type: {
        dispensers: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
        instructions: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        date: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        default: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
      },
    },
    defaultVariants: {
      type: "default",
    },
  }
);

interface JobCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof jobCardVariants> {
  order: WorkOrder;
  // Props for actions, passed from parent
  onViewInstructions: (e: React.MouseEvent, order: WorkOrder) => void;
  onViewDispenserData: (e: React.MouseEvent, order: WorkOrder) => void;
  onClearDispenserData: (orderId: string, e: React.MouseEvent) => Promise<void>;
  onForceRescrapeDispenserData: (orderId: string, e: React.MouseEvent) => Promise<void>;
  onToggleFavorite: (orderId: string, e: React.MouseEvent) => void;
  isFavorite: boolean;
  operationLoading: Record<string, boolean>; // For button loading states
  // getWorkFossaUrl: (workOrderId?: string, visitId?: string) => string; // Removed as it will be local
}

export const JobCard = React.forwardRef<HTMLDivElement, JobCardProps>(
  (
    {
      order,
      className,
      // storeTypeName prop will be derived from order
      onViewInstructions,
      onViewDispenserData,
      onClearDispenserData,
      onForceRescrapeDispenserData,
      onToggleFavorite,
      isFavorite,
      operationLoading,
      ...props
    },
    ref
  ) => {
    const storeType = getStoreTypeForFiltering(order);
    const styles = getStoreStyles(storeType); // Use existing getStoreStyles
    const visitNumber = extractVisitNumber(order);
    const dispenserCount = order.dispensers?.length || 0;
    const shortInstructions = processInstructions(order.instructions, order);

    const jobDate = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.scheduledDate || order.date;
    const formattedJobDate = jobDate ? new Date(jobDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Date N/A';

    const getWorkFossaUrl = (workOrderId?: string, visitId?: string) => {
      if (workOrderId && visitId && visitId !== 'N/A') {
        return `https://app.workfossa.com/workorders/${workOrderId}/visits/${visitId}`;
      } else if (workOrderId) {
        return `https://app.workfossa.com/workorders/${workOrderId}`;
      }
      return 'https://app.workfossa.com';
    };
    const fossaUrl = getWorkFossaUrl(order.workOrderId, visitNumber);

    return (
      <Card
        ref={ref}
        className={cn(
          styles.cardBorder, // Apply border from getStoreStyles
          "group hover:shadow-lg dark:hover:shadow-slate-800/30 transition-all duration-200 mb-4", // Added mb-4 for spacing
          className
        )}
        {...props}
        data-store-type={storeType}
        data-work-order-id={order.workOrderId || 'N/A'}
        data-visit-id={visitNumber || 'N/A'}
      >
        {/* Card Header */}
        <div className={cn("flex items-start justify-between p-4 border-b", styles.headerBg)}>
          <div className="flex-grow">
            <h3 className={cn("font-semibold text-lg", styles.text)}>
              {order.customer.name}
              {order.customer.storeNumber && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  (#{order.customer.storeNumber.replace(/^#+/, "")})
                </span>
              )}
            </h3>
            {order.workOrderId && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                WO: {order.workOrderId}
                {visitNumber && visitNumber !== 'N/A' && ` / Visit: ${visitNumber}`}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => onToggleFavorite(order.id, e)}
            className={cn(
              "rounded-full", // Removed w-8 h-8
              isFavorite ? "text-yellow-500 dark:text-yellow-400" : "text-gray-400 dark:text-gray-500 hover:text-yellow-500"
            )}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <FiStar className={cn("h-5 w-5", isFavorite ? "fill-current" : "")} />
          </Button>
        </div>

        {/* Card Content */}
        <div className="p-4 space-y-3">
          {/* Info Grid: Date, Dispensers, Instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {formattedJobDate !== 'Date N/A' && (
                 <div className="flex items-center gap-2 text-sm">
                    <div className={cn("flex items-center justify-center w-7 h-7 rounded-full", styles.badge)}>
                        <FiCalendar className={cn("h-4 w-4", styles.text)} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Job Date</span>
                        <span className={cn("font-medium", styles.text)}>{formattedJobDate}</span>
                    </div>
                </div>
            )}

            {dispenserCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                    <div className={cn("flex items-center justify-center w-7 h-7 rounded-full", styles.badge)}>
                        <GiGasPump className={cn("h-4 w-4", styles.text)} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Equipment</span>
                        <span className={cn("font-medium", styles.text)}>{dispenserCount} Dispenser{dispenserCount !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            )}
          </div>
          
          {/* Short Instructions display */}
          {shortInstructions && (
            <div className="mt-2">
                <div className="flex items-center gap-2 text-sm">
                     <div className={cn("flex items-center justify-center w-7 h-7 rounded-full self-start mt-0.5", styles.badge)}>
                        <FiFileText className={cn("h-4 w-4", styles.text)} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Notes</span>
                        <p className={cn("text-sm whitespace-normal break-words", styles.text, !shortInstructions && "italic")}>
                            {shortInstructions || "No specific notes"}
                        </p>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* Card Actions - adapted from original renderJobRow */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/20 dark:bg-slate-800/30 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => onViewInstructions(e, order)}
            disabled={!order.instructions || operationLoading[`instr_${order.id}`]}
            className={`text-xs hover:bg-background ${styles.text}`}
            style={{ borderColor: styles.dot }}
          >
            <FiFileText className="mr-1.5 h-3.5 w-3.5" />
            {operationLoading[`instr_${order.id}`] ? "Loading..." : "Instructions"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => onViewDispenserData(e, order)}
            disabled={operationLoading[`disp_${order.id}`] || dispenserCount === 0}
            className={cn("text-xs hover:bg-background", styles.text)}
            style={{ borderColor: styles.dot }}
          >
            <GiGasPump className="mr-1.5 h-3.5 w-3.5" />
            {operationLoading[`disp_${order.id}`] ? "Loading..." : "Dispensers"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => onClearDispenserData(order.id, e)}
            disabled={operationLoading[`clear_${order.id}`] || dispenserCount === 0}
            className={cn("text-xs hover:bg-background", styles.text)}
            style={{ borderColor: styles.dot }}
          >
            <FiTrash2 className="mr-1.5 h-3.5 w-3.5" />
            {operationLoading[`clear_${order.id}`] ? "Clearing..." : "Clear Data"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => onForceRescrapeDispenserData(order.id, e)}
            disabled={operationLoading[`rescrape_${order.id}`]}
            className={cn("text-xs hover:bg-background", styles.text)}
            style={{ borderColor: styles.dot }}
          >
            <FiRefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {operationLoading[`rescrape_${order.id}`] ? "Rescraping..." : "Force Rescrape"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild // Important for rendering <a> tag correctly
            className={cn("text-xs hover:bg-background", styles.text)}
            style={{ borderColor: styles.dot }}
          >
            <a
              href={fossaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <FiExternalLink className="mr-1.5 h-3.5 w-3.5" />
              WorkFossa
            </a>
          </Button>
        </div>
      </Card>
    );
  }
);

JobCard.displayName = "JobCard";

// Default export for dynamic import if needed, or can be removed if not used that way.
// export default JobCard; 