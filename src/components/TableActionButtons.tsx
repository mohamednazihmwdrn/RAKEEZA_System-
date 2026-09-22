import React from 'react';

interface TableActionButtonsProps {
  onPrint: () => void;
  onExportExcel: () => void;
  printTitle?: string;
  exportTitle?: string;
  printLabel?: string;
  exportLabel?: string;
  className?: string;
  disabled?: boolean;
}

export const TableActionButtons: React.FC<TableActionButtonsProps> = ({
  onPrint,
  onExportExcel,
  printTitle = 'طباعة السجل',
  exportTitle = 'تصدير إلى ملف Excel',
  printLabel = 'طباعة السجل',
  exportLabel = 'تصدير Excel',
  className = '',
  disabled = false,
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${className}`}>
      <button
        type="button"
        onClick={onPrint}
        disabled={disabled}
        className="flex-1 sm:flex-initial min-h-[42px] bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white px-3 sm:px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
        title={printTitle}
      >
        <span>🖨️</span>
        <span>{printLabel}</span>
      </button>
      <button
        type="button"
        onClick={onExportExcel}
        disabled={disabled}
        className="flex-1 sm:flex-initial min-h-[42px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50 text-white px-3 sm:px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
        title={exportTitle}
      >
        <span>📊</span>
        <span>{exportLabel}</span>
      </button>
    </div>
  );
};
