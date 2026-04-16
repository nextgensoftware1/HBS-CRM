// frontend/src/components/common/Card.tsx
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-[var(--color-background)]/90 backdrop-blur rounded-2xl shadow-[var(--shadow-sm)] border border-[var(--color-border-soft)] ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  );
}