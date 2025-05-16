import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiChevronRight, FiArrowRight, FiCalendar, FiCheck, FiClock, FiX, FiAlertTriangle,
  FiInfo, FiUpload, FiRefreshCw, FiPlay, FiMapPin, FiFileText, FiCheckCircle, FiXCircle, FiLoader,
  FiExternalLink, FiClipboard, FiSearch, FiChevronDown, FiEye
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
// Import work order data from the local data file
import workOrderData from '../data/scraped_content.json';
// Import form service
import { 
  processSingleVisit, 
  getFormAutomationStatus, 
  processBatchVisits, 
  getBatchAutomationStatus,
  cancelFormAutomation,
  openUrlWithDebugMode,
  FormAutomationStatus,
  BatchAutomationStatus
} from '../services/formService';
import { ENDPOINTS } from '../config/api';

// Add service for retrieving dispenser information
import { getDispensersForWorkOrder } from '../services/dispenserService';

// Helper functions for localStorage
const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving to localStorage: ${error}`);
  }
};

const getFromStorage = (key: string, defaultValue: any) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage: ${error}`);
    return defaultValue;
  }
};

// Storage keys for localStorage
const STORAGE_KEYS = {
  FORM_JOBS: 'form_prep_jobs',
  SINGLE_JOB_ID: 'form_prep_single_job_id',
  BATCH_JOB_ID: 'form_prep_batch_job_id',
  IS_POLLING_SINGLE: 'form_prep_is_polling_single',
  LAST_STATUS_UPDATE: 'form_prep_last_status_update',
  VISIT_URL: 'form_prep_visit_url'
};

// Types
interface FormJob {
  url: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
  timestamp?: string;
  headless: boolean;
  storeName?: string;
  visitNumber?: string;
  dispenserCount?: number;
  startTime?: number;
  endTime?: number;
  _statusChanged?: boolean;
  _completed?: boolean;
  _error?: boolean;
  jobId?: string;
}

interface BatchJob {
  filePath: string;
  timestamp: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
  totalVisits: number;
  completedVisits: number;
  headless: boolean;
  jobId?: string;
}

const FormPrep: React.FC = () => {
  const { addToast } = useToast();
  const { isDark } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);

  // Simplified component for testing syntax
  return (
    <div className="container">
      <div className="grid">
        <div className="panel">
          <h2>Form Preparation</h2>
          {batchJobs.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {batchJobs.map((job, index) => (
                  <tr key={index}>
                    <td>{job.status}</td>
                    <td>{job.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormPrep;
