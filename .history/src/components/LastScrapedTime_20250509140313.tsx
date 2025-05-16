import React, { useState, useEffect } from 'react';
import { formatDate, formatTimeFromNow } from '../utils/dateUtils';
import { FaClock, FaInfoCircle } from 'react-icons/fa';
import { ENDPOINTS } from '../config/api';
import Tooltip from 'react-tooltip';

interface LastScrapedTimeProps {
  timestamp?: string;
}

const LastScrapedTime: React.FC<LastScrapedTimeProps> = ({ timestamp: initialTimestamp }) => {
  const [timestamp, setTimestamp] = useState<string | undefined>(initialTimestamp);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [relativeTime, setRelativeTime] = useState<string>('');

  const fetchLastScrapedTime = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Make sure we use the API URL from the proxy configuration
      const response = await fetch('/api/last-scraped', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error(`Error status: ${response.status}, ${response.statusText}`);
        throw new Error(`Failed to fetch last scraped time: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received last scraped time:', data);
      
      if (data.timestamp) {
        setTimestamp(data.timestamp);
      }
    } catch (error) {
      console.error('Error fetching last scraped time:', error);
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
    fetchLastScrapedTime();
    // Refresh every 5 minutes
    const interval = setInterval(fetchLastScrapedTime, 5 * 60 * 1000);
    
    // Listen for API port changes to refresh data
    const handlePortChange = () => {
      console.log('API port changed, refreshing data');
      fetchLastScrapedTime();
    };
    
    // Listen for scrape completion events
    const handleScrapeComplete = (event: CustomEvent) => {
      console.log('Scrape completed, updating timestamp');
      fetchLastScrapedTime();
    };
    
    // Listen for data updated events (from silentReload or manual refresh)
    const handleDataUpdated = (event: CustomEvent) => {
      console.log('Data updated event detected, refreshing last scraped time');
      // Short delay to ensure the backend has updated the timestamp
      setTimeout(fetchLastScrapedTime, 500);
    };
    
    window.addEventListener('api-port-changed', handlePortChange);
    window.addEventListener('scrape-complete', handleScrapeComplete as EventListener);
    window.addEventListener('fossa-data-updated', handleDataUpdated as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('api-port-changed', handlePortChange);
      window.removeEventListener('scrape-complete', handleScrapeComplete as EventListener);
      window.removeEventListener('fossa-data-updated', handleDataUpdated as EventListener);
    };
  }, []);

  const tooltipId = "last-update-tooltip";

  return (
    <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700">
        <FaClock className="text-gray-500 dark:text-gray-400 text-xs" />
      </div>
      {isLoading ? (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Last updated</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 italic">Loading...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Last updated</span>
          <span className="text-xs text-red-500">{`Error: ${error}`}</span>
        </div>
      ) : timestamp ? (
        <div className="flex flex-col">
          <span 
            className="text-xs font-medium text-gray-600 dark:text-gray-400 cursor-help"
            data-tooltip-id={tooltipId}
          >
            {relativeTime}
          </span>
          <Tooltip id={tooltipId} place="top" effect="solid" className="tooltip-custom">
            <div className="text-xs py-1">
              <div className="font-medium mb-1">Last data update</div>
              <div>{timeDisplay}</div>
            </div>
          </Tooltip>
        </div>
      ) : (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Last updated</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 italic">No data available</span>
        </div>
      )}
    </div>
  );
};

export default LastScrapedTime; 