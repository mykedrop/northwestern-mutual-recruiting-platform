import React from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export const CandidateCardSkeleton = () => (
  <div className="p-4 border rounded-lg">
    <Skeleton height={24} width="60%" className="mb-2" />
    <Skeleton height={16} width="40%" className="mb-1" />
    <Skeleton height={16} width="30%" />
    <div className="mt-3">
      <Skeleton height={32} width="100%" />
    </div>
  </div>
);

export const TableRowSkeleton = () => (
  <tr>
    <td className="p-3"><Skeleton /></td>
    <td className="p-3"><Skeleton /></td>
    <td className="p-3"><Skeleton /></td>
    <td className="p-3"><Skeleton /></td>
    <td className="p-3"><Skeleton width={80} /></td>
  </tr>
);

export const PipelineColumnSkeleton = () => (
  <div className="bg-gray-50 rounded-lg p-4 min-h-[400px]">
    <Skeleton height={24} className="mb-4" />
    <div className="space-y-3">
      <Skeleton height={80} />
      <Skeleton height={80} />
      <Skeleton height={80} />
    </div>
  </div>
);

export const LoadingSpinner = ({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-b-2 border-blue-600`} />
    </div>
  );
};

export const FullPageLoader = () => (
  <div className="fixed inset-0 bg-white bg-opacity-75 z-50 flex items-center justify-center">
    <div className="text-center">
      <LoadingSpinner size="large" />
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);

export const ButtonLoader = () => (
  <span className="inline-flex items-center">
    <LoadingSpinner size="small" />
    <span className="ml-2">Processing...</span>
  </span>
);
