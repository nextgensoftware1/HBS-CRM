// frontend/src/components/common/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-[var(--color-primary)] text-white shadow-[var(--shadow-sm)] hover:brightness-95 focus:ring-[var(--color-secondary)]',
    secondary: 'bg-[var(--color-background)] text-[var(--color-text-dark)] border border-[var(--color-border-soft)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-background)]/95 focus:ring-[var(--color-border-soft)]',
    success: 'bg-[var(--color-success)] text-white shadow-[var(--shadow-sm)] hover:brightness-95 focus:ring-[var(--color-success)]',
    danger: 'bg-[var(--color-danger)] text-white shadow-[var(--shadow-sm)] hover:brightness-95 focus:ring-[var(--color-danger)]',
    ghost: 'text-[var(--color-text-dark)] hover:bg-[var(--color-background)] focus:ring-[var(--color-border-soft)]',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
}