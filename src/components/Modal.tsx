import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, title, onClose, children, footer, maxWidth = 'max-w-4xl' }) => {
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
      className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl p-3 sm:p-6 ${maxWidth} w-full max-h-[95vh] sm:max-h-[92vh] flex flex-col shadow-2xl border-2 border-slate-400 animate-slideUp sm:animate-none`}>
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 mb-3 border-b-2 border-slate-300 shrink-0">
          <h3 className="text-base sm:text-lg font-black text-[#000000] truncate pl-2">{title}</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-slate-200 hover:bg-red-600 text-slate-800 hover:text-white text-xl font-black transition cursor-pointer"
            aria-label="إغلاق النافذة"
          >
            ✕
          </button>
        </div>

        {/* Modal Content with smooth touch scrolling */}
        <div className="overflow-y-auto overscroll-contain flex-1 pr-0.5 -mr-0.5">{children}</div>

        {/* Modal Footer (if provided) */}
        {footer && (
          <div className="pt-3 mt-3 border-t-2 border-slate-300 shrink-0 bg-slate-100 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-3 sm:p-4 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

