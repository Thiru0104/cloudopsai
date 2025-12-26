import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input: React.FC<InputProps> = ({ 
  className = '',
  type = 'text',
  ...props 
}) => {
  return (
    <input 
      type={type}
      className={`input-modern w-full ${className}`}
      {...props}
    />
  );
};