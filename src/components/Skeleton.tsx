import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: string;
  animation?: 'pulse' | 'shimmer' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = 'rounded-md',
  animation = 'shimmer',
}) => {
  const style: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
    height: height ? (typeof height === 'number' ? `${height}px` : height) : '1rem',
  };

  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 ${rounded} ${
        animation === 'shimmer' ? 'shimmer' : animation === 'pulse' ? 'animate-pulse' : ''
      } ${className}`}
      style={style}
    />
  );
};

export const SkeletonText: React.FC<SkeletonProps & { lines?: number }> = ({
  lines = 1,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 && lines > 1 ? '80%' : '100%'}
          {...props}
        />
      ))}
    </div>
  );
};

export const SkeletonCircle: React.FC<Omit<SkeletonProps, 'rounded'> & { size?: number }> = ({
  size = 40,
  className = '',
  ...props
}) => {
  return (
    <Skeleton
      width={size}
      height={size}
      rounded="rounded-full"
      className={className}
      {...props}
    />
  );
};

export const SkeletonAvatar: React.FC<SkeletonProps & { size?: number }> = ({
  size = 40,
  className = '',
  ...props
}) => {
  return (
    <div className="flex items-center gap-2">
      <SkeletonCircle size={size} {...props} />
      <div className="flex flex-col gap-1">
        <Skeleton width={80} height={10} {...props} />
        <Skeleton width={120} height={8} {...props} />
      </div>
    </div>
  );
};

export const SkeletonCard: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-3 p-4 ${className}`}>
      <Skeleton height={150} {...props} />
      <SkeletonText lines={3} {...props} />
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number } & SkeletonProps> = ({
  rows = 5,
  columns = 4,
  className = '',
  ...props
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex gap-4 mb-2">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} height={30} {...props} className="flex-1" />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 mb-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} height={20} {...props} className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const SkeletonDashboardStats: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <Skeleton width={80} height={16} {...props} className="mb-2" />
          <Skeleton width={120} height={28} {...props} className="mb-4" />
          <Skeleton width="100%" height={4} {...props} />
        </div>
      ))}
    </div>
  );
};

export const SkeletonJobsList: React.FC<{ items?: number } & SkeletonProps> = ({
  items = 5,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex flex-col gap-2 flex-grow">
            <Skeleton width="60%" height={20} {...props} />
            <div className="flex gap-2">
              <Skeleton width={80} height={16} {...props} />
              <Skeleton width={100} height={16} {...props} />
            </div>
          </div>
          <div className="flex gap-2">
            <SkeletonCircle size={32} {...props} />
            <SkeletonCircle size={32} {...props} />
          </div>
        </div>
      ))}
    </div>
  );
}; 