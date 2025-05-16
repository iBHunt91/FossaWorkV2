import React from 'react';
import { FiCheckCircle, FiClock, FiLoader, FiXCircle } from 'react-icons/fi';

interface FuelGradeProgress {
  grade: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  prover?: string;
  meter?: string;
  message?: string;
}

interface DispenserProgress {
  dispenserTitle: string;
  dispenserNumber?: string;
  formNumber: number;
  totalForms: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  fuelGrades: FuelGradeProgress[];
  currentAction?: string;
}

interface DispenserProgressCardProps {
  progress: DispenserProgress;
}

const DispenserProgressCard: React.FC<DispenserProgressCardProps> = ({ progress }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'processing':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <FiClock className="h-4 w-4" />;
      case 'processing':
        return <FiLoader className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <FiCheckCircle className="h-4 w-4" />;
      case 'error':
        return <FiXCircle className="h-4 w-4" />;
      default:
        return <FiClock className="h-4 w-4" />;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 dark:bg-gray-800';
      case 'processing':
        return 'bg-blue-50 dark:bg-blue-900/20';
      case 'completed':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20';
      default:
        return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  return (
    <div className={`rounded-lg p-4 mb-3 border ${getStatusBgColor(progress.status)} border-gray-200 dark:border-gray-700`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className={getStatusColor(progress.status)}>
            {getStatusIcon(progress.status)}
          </span>
          <h4 className="font-medium text-gray-900 dark:text-white">
            {progress.dispenserTitle}
            {progress.dispenserNumber && (
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                #{progress.dispenserNumber}
              </span>
            )}
          </h4>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Form {progress.formNumber}/{progress.totalForms}
        </span>
      </div>

      {/* Current Action */}
      {progress.currentAction && (
        <div className="mb-3 text-sm text-gray-600 dark:text-gray-300 italic">
          {progress.currentAction}
        </div>
      )}

      {/* Fuel Grades Progress */}
      {progress.fuelGrades.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fuel Grades:
          </h5>
          {progress.fuelGrades.map((fuel, index) => (
            <div 
              key={index} 
              className={`flex items-center justify-between p-2 rounded-md ${getStatusBgColor(fuel.status)}`}
            >
              <div className="flex items-center gap-2">
                <span className={getStatusColor(fuel.status)}>
                  {getStatusIcon(fuel.status)}
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {fuel.grade}
                </span>
              </div>
              
              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                {fuel.prover && (
                  <span>
                    P: {fuel.prover}
                  </span>
                )}
                {fuel.meter && (
                  <span>
                    M: {fuel.meter}
                  </span>
                )}
                {fuel.message && (
                  <span className="italic">
                    {fuel.message}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {progress.status === 'processing' && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 animate-pulse" 
              style={{ 
                width: `${((progress.fuelGrades.filter(f => f.status === 'completed').length) / progress.fuelGrades.length) * 100}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DispenserProgressCard;