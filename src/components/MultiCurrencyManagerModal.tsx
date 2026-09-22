import React, { useState } from 'react';
import { AppData, CurrencyDef } from '../types';
import { DEFAULT_CURRENCIES } from '../services/currencyService';
import { addAuditLog } from '../utils/storage';

interface MultiCurrencyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const MultiCurrencyManagerModal: React.FC<MultiCurrencyManagerModalProps> = ({
  isOpen,
  onClose,
  appData,
  onUpdateData,
  showToast,
}) => {
  const [currencies, setCurrencies] = useState<CurrencyDef[]>(
    appData.currencies && appData.currencies.length > 0 ? appData.currencies : DEFAULT_CURRENCIES
  );

  // Quick Currency Converter calculator
  const [calcAmount, setCalcAmount] = useState<string>('100');
  const [fromCode, setFromCode] = useState<string>('USD');
  const [toCode, setToCode] = useState<string>('EGP');

  if (!isOpen) return null;

  const handleRateChange = (code: string, newRate: number) => {
    setCurrencies((prev) =>
      prev.map((c) => (c.code === code ? { ...c, exchangeRate: newRate, lastUpdated: new Date().toISOString().split('T')[0] } : c))
    );
  };

  const handleSave = () => {
    let updatedData: AppData = {
      ...appData,
      currencies,
      multiCurrencyConfig: {
        enabled: true,
        baseCurrency: 'EGP',
        allowAutoFxGainLoss: true,
      },
    };

    updatedData = addAuditLog(
      updatedData,
      'update',
      'إدارة العملات والـ FX',
      'تم تحديث جدول أسعار صرف العملات الأجنبية مقابل الجنيه المصري'
    );

    onUpdateData(updatedData);
    showToast('تم حفظ أسعار صرف العملات بنجاح', 'success');
    onClose();
  };

  // Convert
  const fromCurr = currencies.find((c) => c.code === fromCode);
  const toCurr = currencies.find((c) => c.code === toCode);
  const amt = parseFloat(calcAmount) || 0;
  const inEgp = amt * (fromCurr?.exchangeRate || 1);
  const convertedValue = (toCurr && toCurr.exchangeRate > 0) ? inEgp / toCurr.exchangeRate : inEgp;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-black text-lg text-[#1a237e] flex items-center gap-2">
              <span>💱</span> محرك العملات المتعددة وفروق أسعار الصرف (Multi-Currency Engine)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تحديد أسعار صرف العملات الأجنبية مقابل الجنيه المصري (EGP) لاحتساب أرباح وخسائر فروق العملة
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Currency Rates Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700">جدول أسعار الصرف الحالية (معتمدة في الفواتير والخزائن):</h4>
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#1a237e] text-white">
                <tr>
                  <th className="p-2.5">رمز العملة</th>
                  <th className="p-2.5">اسم العملة</th>
                  <th className="p-2.5">الرمز</th>
                  <th className="p-2.5">سعر الصرف (مقابل 1 ج.م)</th>
                  <th className="p-2.5">نوع العملة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currencies.map((c) => (
                  <tr key={c.code} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-black text-indigo-900">{c.code}</td>
                    <td className="p-2.5 font-bold text-slate-800">{c.name}</td>
                    <td className="p-2.5 font-bold text-slate-600">{c.symbol}</td>
                    <td className="p-2.5">
                      {c.isBaseCurrency ? (
                        <span className="font-mono font-bold text-emerald-700">1.000 (العملة الأساسية)</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0.001"
                            value={c.exchangeRate}
                            onChange={(e) => handleRateChange(c.code, parseFloat(e.target.value) || 0)}
                            className="w-24 p-1.5 border border-indigo-200 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:outline-none"
                          />
                          <span className="text-[11px] text-slate-500">ج.م</span>
                        </div>
                      )}
                    </td>
                    <td className="p-2.5">
                      {c.isBaseCurrency ? (
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                          الأساس
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          أجنبي
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Converter Widget */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>⚡</span> حاسبة تحويل العملات اللحظية:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">المبلغ:</label>
              <input
                type="number"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">من عملة:</label>
              <select
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none bg-white"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">إلى عملة:</label>
              <select
                value={toCode}
                onChange={(e) => setToCode(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none bg-white"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-bold">القيمة المعادلة:</span>
            <span className="text-base font-mono font-black text-[#1a237e]">
              {convertedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {toCurr?.symbol}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
          >
            إغلاق
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-[#1a237e] hover:bg-[#0d47a1] text-white font-bold rounded-xl text-xs transition shadow-sm"
          >
            حفظ وتفعيل الأسعار
          </button>
        </div>
      </div>
    </div>
  );
};
