// frontend/src/components/common/Badge.tsx
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'gray';
  className?: string;
}

export default function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    gray: 'badge-gray',
  };

  return (
    <span className={`badge ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Status badge helper
export function StatusBadge({ status }: { status: string }) {
  const getVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'gray' => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'active':
      case 'completed':
        return 'success';
      case 'pending':
      case 'in_review':
      case 'submitted':
        return 'warning';
      case 'rejected':
      case 'inactive':
      case 'expired':
        return 'danger';
      case 'intake':
      case 'document_collection':
        return 'info';
      default:
        return 'gray';
    }
  };

  const formatStatus = (status: string) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return <Badge variant={getVariant(status)}>{formatStatus(status)}</Badge>;
}