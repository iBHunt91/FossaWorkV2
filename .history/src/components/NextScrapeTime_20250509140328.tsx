import React, { useState, useEffect } from 'react';
import { formatDate, formatTimeFromNow } from '../utils/dateUtils';
import { FaClock, FaCalendarAlt } from 'react-icons/fa';
import { ENDPOINTS } from '../config/api';
import Tooltip from 'react-tooltip';

interface NextScrapeTimeProps {
  timestamp?: string;
}

const NextScrapeTime: React.FC<NextScrapeTimeProps> = ({ timestamp: initialTimestamp }) => {
  const [timestamp, setTimestamp] = useState<string | undefined>(initialTimestamp);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [relativeTime, setRelativeTime] = useState<string>('');

  const fetchNextScrapeTime = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Make sure we use the API URL from the proxy configuration
      const response = await fetch('/api/next-scrape', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error(`Error status: ${response.status}, ${response.statusText}`);
        throw new Error(`Failed to fetch next scrape time: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received next scrape time:', data);
      
      if (data.timestamp) {
        setTimestamp(data.timestamp);
      }
    } catch (error) {
      console.error('Error fetching next scrape time:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Update the displayed times
  useEffect(() => {
    if (timestamp) {
      setTimeDisplay(formatDate(timestamp));
      setRelativeTime(formatTimeFromNow(timestamp));
      
      // Update relative time every minute
      const intervalId = setInterval(() => {
        setRelativeTime(formatTimeFromNow(timestamp));
      }, 60000);
      
      return () => clearInterval(intervalId);
    }
  }, [timestamp]);

  useEffect(() => {
    fetchNextScrapeTime();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNextScrapeTime, 5 * 60 * 1000);
    
    // Listen for API port changes to refresh data
    const handlePortChange = () => {
      console.log('API port changed, refreshing data');
      fetchNextScrapeTime();
    };
    
    window.addEventListener('api-port-changed', handlePortChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('api-port-changed', handlePortChange);
    };
  }, []);

  const tooltipId = "next-update-tooltip";

  return (
    <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/30">
        <FaCalendarAlt className="text-blue-500 dark:text-blue-400 text-xs" />
      </div>
      {isLoading ? (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Next update</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 italic">Loading...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Next update</span>
          <span className="text-xs text-red-500">{`Error: ${error}`}</span>
        </div>
      ) : timestamp ? (
        <div className="flex flex-col">
          <span 
            className="text-xs font-medium text-blue-600 dark:text-blue-400 cursor-help"
            data-tooltip-id={tooltipId}
          >
            {relativeTime}
          </span>
          <Tooltip id={tooltipId} place="top" effect="solid" className="tooltip-custom">
            <div className="text-xs py-1">
              <div className="font-medium mb-1">Next scheduled update</div>
              <div>{timeDisplay}</div>
            </div>
          </Tooltip>
        </div>
      ) : (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Next update</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 italic">No schedule available</span>
        </div>
      )}
    </div>
  );
};

export default NextScrapeTime; 