import React from 'react';
import { Balance, Participant } from '../types';

interface BalanceBarProps {
  balance: Balance;
  participant: Participant;
  maxVal: number;
}

export const BalanceBar: React.FC<BalanceBarProps> = ({ balance, participant, maxVal }) => {
  const isPositive = balance.net >= 0;
  const percentage = maxVal > 0 ? (Math.abs(balance.net) / maxVal) * 100 : 0;
  
  // Cap at 100% for visual sanity
  const width = Math.min(percentage, 100);

  return (
    <div className="flex items-center text-sm py-2">
      <div className="w-20 truncate font-medium text-gray-700 shrink-0">
        {participant.name}
      </div>
      
      <div className="flex-1 flex items-center mx-2 h-8 relative">
        {/* Center Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 transform -translate-x-1/2"></div>
        
        {/* Bar */}
        <div className="w-full h-4 relative bg-gray-100 rounded-full overflow-hidden">
             <div 
                className={`absolute h-full rounded-sm transition-all duration-500 ${isPositive ? 'bg-green-500 left-1/2' : 'bg-red-500 right-1/2'}`}
                style={{ width: `${width / 2}%` }}
             />
        </div>
      </div>

      <div className={`w-20 text-right font-bold shrink-0 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : ''}{balance.net.toFixed(0)}
      </div>
    </div>
  );
};