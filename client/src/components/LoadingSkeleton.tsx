import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'card' | 'text' | 'avatar' | 'button' | 'table';
  count?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'card',
  count = 1,
  className = ''
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (variant === 'card') {
    return (
      <>
        {skeletons.map((i) => (
          <div key={i} className={`animate-pulse bg-white rounded-xl shadow-lg border border-gray-100 p-6 ${className}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
            </div>
            <div className="h-10 bg-gray-300 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </>
    );
  }

  if (variant === 'text') {
    return (
      <>
        {skeletons.map((i) => (
          <div key={i} className={`animate-pulse ${className}`}>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          </div>
        ))}
      </>
    );
  }

  if (variant === 'avatar') {
    return (
      <>
        {skeletons.map((i) => (
          <div key={i} className={`animate-pulse ${className}`}>
            <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
          </div>
        ))}
      </>
    );
  }

  if (variant === 'button') {
    return (
      <>
        {skeletons.map((i) => (
          <div key={i} className={`animate-pulse ${className}`}>
            <div className="h-10 bg-gray-200 rounded-lg w-24"></div>
          </div>
        ))}
      </>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`animate-pulse ${className}`}>
        {skeletons.map((i) => (
          <div key={i} className="flex items-center space-x-4 py-3 border-b">
            <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
            <div className="h-8 w-16 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="text-center py-12">
      {icon && <div className="flex justify-center mb-4 text-gray-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-gray-500 mb-6 max-w-md mx-auto">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-nm-blue-500 hover:bg-nm-blue-600 transition-colors duration-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};