import React from 'react';
import { Modal } from './ui/modal';
import { Bug, Database, Calendar, MapPin, User, Package, Globe, Code } from 'lucide-react';
import { cleanSiteName } from '@/utils/storeColors';

interface WorkOrder {
  id: string;
  external_id: string;
  site_name: string;
  address: string;
  scheduled_date?: string | null;
  status: string;
  visit_url?: string;
  visit_id?: string;
  visit_number?: string;
  store_number?: string;
  service_code?: string;
  service_description?: string;
  service_name?: string;
  service_items?: string;
  street?: string;
  city_state?: string;
  county?: string;
  created_date?: string;
  created_by?: string;
  instructions?: string;
  customer_url?: string;
  created_at: string;
  updated_at: string;
  scraped_data?: any;
  dispensers?: any[];
}

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder | null;
}

export const DebugModal: React.FC<DebugModalProps> = ({
  isOpen,
  onClose,
  workOrder
}) => {
  if (!workOrder) return null;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string' && value.trim() === '') return '(empty string)';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getDispenserCount = (): number => {
    if (!workOrder.service_items) return 0;
    
    // Handle both string and array formats
    const items = typeof workOrder.service_items === 'string' 
      ? [workOrder.service_items]
      : Array.isArray(workOrder.service_items) 
        ? workOrder.service_items 
        : [];
    
    for (const item of items) {
      const match = item.match(/(\d+)\s*x\s*(All\s*)?Dispenser/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  };

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return 'Not set';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return `Invalid date: ${dateStr}`;
    }
  };

  const getScrapedDates = () => {
    const dates: string[] = [];
    
    // Check scheduled_date
    if (workOrder.scheduled_date) {
      dates.push(`scheduled_date: ${formatDate(workOrder.scheduled_date)}`);
    }
    
    // Check scraped_data.visit_info.date
    if (workOrder.scraped_data?.visit_info?.date) {
      dates.push(`scraped_data.visit_info.date: ${formatDate(workOrder.scraped_data.visit_info.date)}`);
    }
    
    // Check created_date
    if (workOrder.created_date) {
      dates.push(`created_date: ${formatDate(workOrder.created_date)}`);
    }
    
    // Extract dates from raw HTML
    const rawHtml = workOrder.scraped_data?.raw_html;
    if (rawHtml) {
      const datePatterns = [
        /<div[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})<\/div>/g,
        /(\d{1,2}\/\d{1,2}\/\d{4})\s*\([^)]*\)/g,
        /Next Visit.*?(\d{1,2}\/\d{1,2}\/\d{4})/gi,
        />(\d{1,2}\/\d{1,2}\/\d{4})</g
      ];
      
      const foundDates = new Set<string>();
      datePatterns.forEach((pattern, index) => {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(rawHtml)) !== null) {
          foundDates.add(`Pattern ${index + 1}: ${match[1]}`);
          if (foundDates.size > 10) break; // Limit to prevent too many matches
        }
      });
      
      if (foundDates.size > 0) {
        dates.push(`Raw HTML dates: ${Array.from(foundDates).join(', ')}`);
      }
    }
    
    return dates.length > 0 ? dates : ['No dates found'];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Debug Info: ${cleanSiteName(workOrder.site_name)}`}
      size="xl"
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Main Fields */}
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Main Database Fields
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><strong>ID:</strong> {workOrder.id}</div>
            <div><strong>Work Number:</strong> {formatValue(workOrder.external_id)}</div>
            <div><strong>Site Name:</strong> {formatValue(cleanSiteName(workOrder.site_name))}</div>
            <div><strong>Address:</strong> {formatValue(workOrder.address)}</div>
            <div><strong>Status:</strong> {formatValue(workOrder.status)}</div>
            <div><strong>Visit Number:</strong> {formatValue(workOrder.visit_number || workOrder.visit_id)}</div>
            <div><strong>Visit URL:</strong> {formatValue(workOrder.visit_url)}</div>
            <div><strong>Store Number:</strong> {formatValue(workOrder.store_number)}</div>
            <div><strong>Service Code:</strong> {formatValue(workOrder.service_code)}</div>
            <div><strong>Service Name:</strong> {formatValue(workOrder.service_name)}</div>
            <div className="col-span-2">
              <strong>Service Items:</strong>
              {workOrder.service_items && (
                <div className="ml-4 mt-1">
                  {Array.isArray(workOrder.service_items) ? (
                    workOrder.service_items.map((item, idx) => (
                      <div key={idx}>• {item}</div>
                    ))
                  ) : (
                    <div>• {workOrder.service_items}</div>
                  )}
                  {getDispenserCount() > 0 && (
                    <div className="mt-1 text-blue-600 dark:text-blue-400">
                      → Dispensers: {getDispenserCount()}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div><strong>Customer URL:</strong> {formatValue(workOrder.customer_url)}</div>
          </div>
        </div>

        {/* Address Components */}
        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Address Components
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><strong>Street:</strong> {formatValue(workOrder.street)}</div>
            <div><strong>City/State:</strong> {formatValue(workOrder.city_state)}</div>
            <div><strong>County:</strong> {formatValue(workOrder.county)}</div>
          </div>
        </div>

        {/* Date Information */}
        <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Date Information
          </h3>
          <div className="space-y-2 text-sm">
            <div><strong>Scheduled Date:</strong> {formatDate(workOrder.scheduled_date)}</div>
            <div><strong>Created Date:</strong> {formatDate(workOrder.created_date)}</div>
            <div><strong>DB Created At:</strong> {formatDate(workOrder.created_at)}</div>
            <div><strong>DB Updated At:</strong> {formatDate(workOrder.updated_at)}</div>
            <div><strong>Created By:</strong> {formatValue(workOrder.created_by)}</div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded">
            <h4 className="font-medium mb-2">All Found Dates:</h4>
            <ul className="space-y-1">
              {getScrapedDates().map((date, index) => (
                <li key={index} className="text-xs font-mono">{date}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Scraped Data Structure */}
        <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center">
            <Code className="w-5 h-5 mr-2" />
            Scraped Data Structure
          </h3>
          {workOrder.scraped_data ? (
            <div className="space-y-3">
              <div><strong>Available Keys:</strong> {Object.keys(workOrder.scraped_data).join(', ')}</div>
              
              {/* Address Components */}
              {workOrder.scraped_data.address_components && (
                <div>
                  <strong>Address Components:</strong>
                  <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                    {JSON.stringify(workOrder.scraped_data.address_components, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Service Info */}
              {workOrder.scraped_data.service_info && (
                <div>
                  <strong>Service Info:</strong>
                  <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                    {JSON.stringify(workOrder.scraped_data.service_info, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Visit Info */}
              {workOrder.scraped_data.visit_info && (
                <div>
                  <strong>Visit Info:</strong>
                  <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                    {JSON.stringify(workOrder.scraped_data.visit_info, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 italic">No scraped_data available</div>
          )}
        </div>

        {/* Dispensers */}
        {workOrder.dispensers && workOrder.dispensers.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Dispensers ({workOrder.dispensers.length})
            </h3>
            <div className="space-y-2">
              {workOrder.dispensers.slice(0, 3).map((dispenser, index) => (
                <div key={index} className="text-sm">
                  <strong>Dispenser #{dispenser.dispenser_number}:</strong> {dispenser.dispenser_type}
                  {dispenser.serial_number && <span> (SN: {dispenser.serial_number})</span>}
                </div>
              ))}
              {workOrder.dispensers.length > 3 && (
                <div className="text-xs text-gray-500">... and {workOrder.dispensers.length - 3} more</div>
              )}
            </div>
          </div>
        )}

        {/* Raw HTML Preview */}
        {workOrder.scraped_data?.raw_html && (
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-3 flex items-center">
              <Globe className="w-5 h-5 mr-2" />
              Raw HTML Preview (First 1000 chars)
            </h3>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
              {workOrder.scraped_data.raw_html.substring(0, 1000)}
              {workOrder.scraped_data.raw_html.length > 1000 && '\n... (truncated)'}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
};