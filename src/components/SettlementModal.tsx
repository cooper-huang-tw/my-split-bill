import React, { useMemo } from 'react';
import { X, ArrowRight, Copy, LogOut, CheckCircle2 } from 'lucide-react';
import { Balance, Trip, Settlement } from '../types';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEndTrip: () => void;
  trip: Trip;
  balances: Balance[];
}

export const SettlementModal: React.FC<SettlementModalProps> = ({ isOpen, onClose, onEndTrip, trip, balances }) => {
  if (!isOpen) return null;

  const settlements = useMemo(() => {
    const debtors = balances.filter(b => b.net < -0.01).map(b => ({ ...b }));
    const creditors = balances.filter(b => b.net > 0.01).map(b => ({ ...b }));
    
    // Sort by magnitude to minimize transactions (greedy approach)
    debtors.sort((a, b) => a.net - b.net); // Most negative first
    creditors.sort((a, b) => b.net - a.net); // Most positive first

    const results: Settlement[] = [];
    
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      
      const amount = Math.min(Math.abs(debtor.net), creditor.net);
      
      if (amount > 0) {
        const fromName = trip.participants.find(p => p.id === debtor.participantId)?.name || 'Unknown';
        const toName = trip.participants.find(p => p.id === creditor.participantId)?.name || 'Unknown';

        results.push({ from: fromName, to: toName, amount });
      }

      debtor.net += amount;
      creditor.net -= amount;

      // Move indices if settled
      if (Math.abs(debtor.net) < 0.01) i++;
      if (creditor.net < 0.01) j++;
    }

    return results;
  }, [balances, trip.participants]);

  const handleCopy = () => {
    const lines = balances.map(b => {
      const name = trip.participants.find(p => p.id === b.participantId)?.name || 'Unknown';
      const sign = b.net > 0 ? '+' : '';
      return `${name}: ${sign}${Math.round(b.net)}`;
    });
    const text = `${trip.name} 帳務統計:\n\n${lines.join('\n')}`;
    
    navigator.clipboard.writeText(text).then(() => {
      alert("已複製帳務明細到剪貼簿！");
    });
  };

  const handleEndTrip = () => {
    if (confirm("確定要結束並清空此行程嗎？\n\n這將會清除所有紀錄回到首頁。")) {
        onEndTrip();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-brand-600 p-4 text-white flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold">結算方案 (Settlement)</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Settlement Plan */}
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">建議轉帳 (Transfers)</h3>
            {settlements.length === 0 ? (
                <div className="text-center text-gray-500 py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500" />
                目前沒有需要結算的款項。
                </div>
            ) : (
                <div className="space-y-3">
                {settlements.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center flex-1">
                        <span className="font-semibold text-gray-800">{s.from}</span>
                        <ArrowRight className="mx-2 text-gray-400" size={16} />
                        <span className="font-semibold text-gray-800">{s.to}</span>
                    </div>
                    <div className="text-brand-600 font-bold text-lg">
                        ${s.amount.toFixed(0)}
                    </div>
                    </div>
                ))}
                </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 shrink-0 bg-gray-50 space-y-3">
          <button 
            onClick={handleCopy}
            className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors flex items-center justify-center shadow-sm"
          >
            <Copy size={18} className="mr-2 text-gray-400" />
            複製帳務文字 (Copy Text)
          </button>
          
          <button 
            onClick={handleEndTrip}
            className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors flex items-center justify-center shadow-md shadow-brand-200"
          >
            <LogOut size={18} className="mr-2" />
            確認並結束行程 (End Trip)
          </button>
        </div>
      </div>
    </div>
  );
};