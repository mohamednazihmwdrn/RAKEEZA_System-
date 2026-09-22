import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, title, onClose, children, footer }) => {
  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-4xl w-full max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 animate-slideUp sm:animate-none">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 mb-3 border-b-2 border-gray-200 shrink-0">
          <h3 className="text-base sm:text-lg font-black text-[#1a237e] truncate pl-2">{title}</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-50 text-gray-500 hover:text-red-600 text-xl font-bold transition cursor-pointer"
            aria-label="إغلاق النافذة"
          >
            ✕
          </button>
        </div>

        {/* Modal Content with smooth touch scrolling */}
        <div className="overflow-y-auto overscroll-contain flex-1 pr-0.5 -mr-0.5">{children}</div>

        {/* Modal Footer (if provided) */}
        {footer && (
          <div className="pt-3 mt-3 border-t-2 border-gray-100 shrink-0 bg-slate-50/90 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-3 sm:p-4 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

