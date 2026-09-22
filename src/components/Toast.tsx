import React from 'react';

interface ToastProps {
  message: string | null;
  type: 'success' | 'error' | 'warning' | 'info';
}

export const Toast: React.FC<ToastProps> = ({ message, type }) => {
  if (!message) return null;

  const bgClasses = {
    success: 'bg-[#2e7d32]',
    error: 'bg-[#c62828]',
    warning: 'bg-[#f57f17]',
    info: 'bg-[#1a237e]',
  };

  return (
    <div
      className={`fixed bottom-6 left-6 text-white px-5 py-3 rounded-xl shadow-2xl z-50 text-sm font-semibold max-w-[90vw] animate-bounce ${bgClasses[type]}`}
    >
      {message}
    </div>
  );
};
