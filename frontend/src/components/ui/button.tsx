import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'default', 
  size = 'default',
  className = '',
  ...props 
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30';
      case 'outline':
        return 'border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700';
      case 'secondary':
        return 'bg-slate-100 hover:bg-slate-200 text-slate-900';
      case 'ghost':
        return 'hover:bg-slate-100 text-slate-700';
      case 'link':
        return 'text-blue-600 underline-offset-4 hover:underline';
      default:
        return 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-8 py-4 text-lg';
      case 'icon':
        return 'p-2';
      default:
        return 'px-6 py-3';
    }
  };

  return (
    <button 
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${getVariantClasses()} ${getSizeClasses()} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};