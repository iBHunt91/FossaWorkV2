import React from 'react';
import { FiRefreshCw, FiExternalLink } from 'react-icons/fi';
import LastScrapedTime from '../LastScrapedTime';
import NextScrapeTime from '../NextScrapeTime';
import ScrapeLogsConsole from '../ScrapeLogsConsole';

interface ToolsPanelProps {
  isScrapingWorkOrders: boolean;
  isScrapingDispensers: boolean;
  scrapeWorkOrdersProgress: number;
  scrapeDispensersProgress: number;
  scrapeWorkOrdersMessage: string;
  scrapeDispensersMessage: string;
  handleScrapeWorkOrders: () => void;
  handleScrapeDispenserData: () => void;
  openWorkFossaWithLogin: (targetUrl?: string) => void;
  consoleHeight: number;
  setConsoleHeight: React.Dispatch<React.SetStateAction<number>>;
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({
  isScrapingWorkOrders,
  isScrapingDispensers,
  scrapeWorkOrdersProgress,
  scrapeDispensersProgress,
  scrapeWorkOrdersMessage,
  scrapeDispensersMessage,
  handleScrapeWorkOrders,
  handleScrapeDispenserData,
  openWorkFossaWithLogin,
  consoleHeight,
  setConsoleHeight
}) => {
  
  const handleResize = (height: number) => {
    setConsoleHeight(height);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scrape Work Orders Button */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="mb-2 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Scrape Work Orders</h3>
            <LastScrapedTime type="workOrders" className="text-xs text-gray-500 dark:text-gray-400" />
          </div>
          <div className="flex flex-col">
            <button
              onClick={handleScrapeWorkOrders}
              disabled={isScrapingWorkOrders}
              className={`flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                isScrapingWorkOrders
                  ? 'bg-primary-300 dark:bg-primary-700 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
              }`}
            >
              <FiRefreshCw className={`mr-2 h-4 w-4 ${isScrapingWorkOrders ? 'animate-spin' : ''}`} />
              {isScrapingWorkOrders ? 'Scraping...' : 'Scrape Work Orders'}
            </button>
            {isScrapingWorkOrders && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{scrapeWorkOrdersMessage}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {Math.round(scrapeWorkOrdersProgress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-primary-600 dark:bg-primary-500 h-1.5 rounded-full"
                    style={{ width: `${scrapeWorkOrdersProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            {!isScrapingWorkOrders && (
              <div className="mt-2">
                <NextScrapeTime type="workOrders" className="text-xs text-gray-500 dark:text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Scrape Dispenser Data Button */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="mb-2 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Scrape Dispenser Data</h3>
            <LastScrapedTime type="dispensers" className="text-xs text-gray-500 dark:text-gray-400" />
          </div>
          <div className="flex flex-col">
            <button
              onClick={handleScrapeDispenserData}
              disabled={isScrapingDispensers}
              className={`flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                isScrapingDispensers
                  ? 'bg-primary-300 dark:bg-primary-700 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
              }`}
            >
              <FiRefreshCw className={`mr-2 h-4 w-4 ${isScrapingDispensers ? 'animate-spin' : ''}`} />
              {isScrapingDispensers ? 'Scraping...' : 'Scrape Dispenser Data'}
            </button>
            {isScrapingDispensers && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{scrapeDispensersMessage}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {Math.round(scrapeDispensersProgress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-primary-600 dark:bg-primary-500 h-1.5 rounded-full"
                    style={{ width: `${scrapeDispensersProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            {!isScrapingDispensers && (
              <div className="mt-2">
                <NextScrapeTime type="dispensers" className="text-xs text-gray-500 dark:text-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* External Links */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">External Links</h3>
        <div className="space-y-2">
          <button
            onClick={() => openWorkFossaWithLogin()}
            className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-650"
          >
            <span>Open WorkFossa</span>
            <FiExternalLink className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={() => openWorkFossaWithLogin('https://app.workfossa.com/schedule')}
            className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-650"
          >
            <span>Go to Schedule</span>
            <FiExternalLink className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Scrape Logs Console */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Scrape Logs</h3>
        <ScrapeLogsConsole height={consoleHeight} onResize={handleResize} />
      </div>
    </div>
  );
};

export default ToolsPanel;
