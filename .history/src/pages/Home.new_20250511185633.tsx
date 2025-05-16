import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FiActivity, 
  FiAlertTriangle,
  FiCalendar,
  FiClock, 
  FiDatabase,
  FiExternalLink, 
  FiFileText, 
  FiFilter,
  FiInfo,
  FiList,
  FiMapPin,
  FiPieChart,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiTrash2,
  FiTrendingUp,
} from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { useNavigate } from 'react-router-dom';
import { clearDispenserData, forceRescrapeDispenserData, getDispenserScrapeStatus, getWorkOrders, getScrapeStatus, startDispenserScrapeJob, startScrapeJob } from '../services/scrapeService';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useDispenserData } from '../context/DispenserContext';
import PersistentView, { usePersistentViewContext } from '../components/PersistentView';
import LastScrapedTime from '../components/LastScrapedTime';
import NextScrapeTime from '../components/NextScrapeTime';
import ScrapeLogsConsole from '../components/ScrapeLogsConsole';
import DispenserModal from '../components/DispenserModal';
import InstructionsModal from '../components/InstructionsModal';
import JobMap from '../components/map/JobMap';
import { SkeletonDashboardStats, SkeletonJobsList } from '../components/Skeleton';
import fuelGrades from '../data/fuel_grades';

// Type definitions
type ViewType = 'weekly' | 'calendar' | 'compact';
type StoreFilter = 'all' | '7-eleven' | 'circle-k' | 'wawa' | 'other' | string;

type Customer = {
  name: string;
  storeNumber?: string | null;
  rawHtml?: string;
};

type Dispenser = {
  title: string;
  serial?: string;
  make?: string;
  model?: string;
  fields?: {[key: string]: string};
  html?: string;
};

type WorkOrder = {
  id: string;
  workOrderId?: string;
  customer: Customer;
  services: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string;
  }>;
  visits: Record<string, any>;
  instructions: string;
  rawHtml: string;
  dispensers?: Dispenser[];
  scheduledDate?: string;
  nextVisitDate?: string;
  visitDate?: string;
  date?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
};

interface WorkWeekDateRanges {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
}

// Custom hook for persisting scraper status
const usePersistentScrapeStatus = (key: string, initialStatus: {
  status: string;
  progress: number;
  message: string;
}) => {
  const [status, setStatus] = useState<{
    status: string;
    progress: number;
    message: string;
  }>(() => {
    const storedStatus = sessionStorage.getItem(`scrape-status-${key}`);
    return storedStatus ? JSON.parse(storedStatus) : initialStatus;
  });

  useEffect(() => {
    sessionStorage.setItem(`scrape-status-${key}`, JSON.stringify(status));
  }, [status, key]);

  return [status, setStatus] as const;
};

// Helper function to calculate work week date ranges
const getWorkWeekDateRanges = (
  workWeekStart: number = 1,
  workWeekEnd: number = 5,
  selectedDate: Date = new Date()
): WorkWeekDateRanges => {
  const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
  const today = dateObj;
  const currentDayOfWeek = today.getDay();
  const currentHour = today.getHours();
  
  const isAfterWorkWeekEnd = (currentDayOfWeek === workWeekEnd && currentHour >= 17) || 
                           currentDayOfWeek > workWeekEnd || 
                           currentDayOfWeek < workWeekStart;
  
  const currentWeekStart = new Date(today);
  let diffToStart;
  
  if (isAfterWorkWeekEnd) {
    diffToStart = (workWeekStart + 7 - currentDayOfWeek) % 7;
    if (diffToStart === 0) diffToStart = 7;
  } else {
    diffToStart = ((currentDayOfWeek - workWeekStart) + 7) % 7;
    currentWeekStart.setDate(today.getDate() - diffToStart);
  }
  
  currentWeekStart.setDate(today.getDate() + (isAfterWorkWeekEnd ? diffToStart : -diffToStart));
  currentWeekStart.setHours(0, 0, 0, 0);
  
  const currentWeekEnd = new Date(currentWeekStart);
  const daysToAdd = workWeekEnd < workWeekStart ? 
    (7 - workWeekStart + workWeekEnd) : 
    (workWeekEnd - workWeekStart);
  
  currentWeekEnd.setDate(currentWeekStart.getDate() + daysToAdd);
  currentWeekEnd.setHours(17, 0, 0, 0);
  
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(currentWeekStart.getDate() + 7);
  
  const nextWeekEnd = new Date(currentWeekEnd);
  nextWeekEnd.setDate(currentWeekEnd.getDate() + 7);
  
  return {
    currentWeekStart,
    currentWeekEnd,
    nextWeekStart,
    nextWeekEnd
  };
};

// Main component
const Home: React.FC = () => {
  return (
    <PersistentView id="home-dashboard" persistScrollPosition={true}>
      <HomeContent />
    </PersistentView>
  );
};

export default Home; 