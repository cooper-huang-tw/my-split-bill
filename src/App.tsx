import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, User, DollarSign, Calendar, Users, ArrowRight, Wallet, Receipt, Trash2, Check, GripVertical, MoreHorizontal, Settings, Share2, Menu, Calculator } from 'lucide-react';
import { Trip, Expense, Balance, Participant } from './types';
import { BalanceBar } from './components/BalanceBar';
import { SettlementModal } from './components/SettlementModal';

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const calculateBalances = (trip: Trip): Balance[] => {
  const balances: Record<string, Balance> = {};

  // Initialize
  trip.participants.forEach(p => {
    balances[p.id] = { participantId: p.id, paid: 0, consumed: 0, net: 0 };
  });

  trip.expenses.forEach(exp => {
    // 1. Paid amounts
    exp.payers.forEach(payer => {
      if (balances[payer.participantId]) {
        balances[payer.participantId].paid += payer.amount;
      }
    });

    // 2. Consumed amounts (Base Split)
    const splitCount = exp.splitters.length;
    if (splitCount > 0) {
      // Calculate total extra adjustments first
      const totalAdjustment = exp.adjustments.reduce((sum, adj) => sum + adj.amount, 0);
      const remainingAmount = exp.totalAmount - totalAdjustment;
      const baseShare = remainingAmount / splitCount;

      exp.splitters.forEach(pid => {
        if (balances[pid]) {
          balances[pid].consumed += baseShare;
        }
      });
      
      // Add adjustments to specific consumers
      exp.adjustments.forEach(adj => {
        if (balances[adj.participantId]) {
           balances[adj.participantId].consumed += adj.amount;
        }
      });
    }
  });

  // Calculate Net
  Object.values(balances).forEach(b => {
    b.net = b.paid - b.consumed;
  });

  return Object.values(balances);
};

// --- Main App Component ---
export default function App() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [view, setView] = useState<'create' | 'dashboard' | 'add_expense'>('create');
  
  // Create Trip State
  const [newTripName, setNewTripName] = useState('');
  const [newParticipants, setNewParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  // Add/Edit Expense State
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substr(0, 10));
  
  // Payers: Map of participantId -> amountString
  const [payers, setPayers] = useState<Record<string, string>>({});
  
  // Splitters: Set of participantIds
  const [splitters, setSplitters] = useState<Set<string>>(new Set());

  // Adjustments: Map of participantId -> amountString (Extra amount)
  const [hasAdjustments, setHasAdjustments] = useState(false);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  // Settlement Modal State
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);

  // Add Participant in Dashboard State
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [newPartNameDashboard, setNewPartNameDashboard] = useState('');
  
  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('tripsplit_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTrip(parsed);
        setView('dashboard');
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    if (trip) {
      localStorage.setItem('tripsplit_state', JSON.stringify(trip));
    } else {
      localStorage.removeItem('tripsplit_state');
    }
  }, [trip]);

  // Derived state
  const balances = useMemo(() => trip ? calculateBalances(trip) : [], [trip]);
  const totalSpent = useMemo(() => trip ? trip.expenses.reduce((sum, e) => sum + e.totalAmount, 0) : 0, [trip]);

  // --- Auto Sync Single Payer ---
  // If only one payer is selected, keep their amount synced with the Total Amount field
  useEffect(() => {
    const payerIds = Object.keys(payers);
    if (payerIds.length === 1) {
        const pid = payerIds[0];
        // Only update if different to avoid potential loops/redundant renders
        if (payers[pid] !== expenseAmount) {
            setPayers({ [pid]: expenseAmount });
        }
    }
  }, [expenseAmount, payers]);

  // --- Handlers ---

  const handleCreateTrip = () => {
    if (!newTripName || newParticipants.length === 0) return;
    const newTrip: Trip = {
      id: generateId(),
      name: newTripName,
      participants: newParticipants.map(name => ({ id: generateId(), name })),
      expenses: [],
      createdAt: Date.now(),
    };
    setTrip(newTrip);
    setView('dashboard');
  };

  const addParticipant = () => {
    if (participantInput.trim() && !isComposing) {
      setNewParticipants([...newParticipants, participantInput.trim()]);
      setParticipantInput('');
    }
  };

  const removeNewParticipant = (index: number) => {
    setNewParticipants(newParticipants.filter((_, i) => i !== index));
  };

  const handleAddParticipantDashboard = () => {
    if (newPartNameDashboard.trim() && trip && !isComposing) {
      const newP: Participant = { id: generateId(), name: newPartNameDashboard.trim() };
      setTrip({
        ...trip,
        participants: [...trip.participants, newP]
      });
      setNewPartNameDashboard('');
      // Keep input focused and ready for next entry, do not close modal
    }
  };

  const initExpenseForm = (expense?: Expense) => {
    if (expense) {
      setEditingExpenseId(expense.id);
      setExpenseTitle(expense.title);
      setExpenseAmount(expense.totalAmount.toString());
      setExpenseDate(new Date(expense.date).toISOString().substr(0, 10));
      
      const pMap: Record<string, string> = {};
      expense.payers.forEach(p => pMap[p.participantId] = p.amount.toString());
      setPayers(pMap);
      
      setSplitters(new Set(expense.splitters));
      
      const aMap: Record<string, string> = {};
      expense.adjustments.forEach(a => aMap[a.participantId] = a.amount.toString());
      setAdjustments(aMap);
      setHasAdjustments(expense.adjustments.length > 0);
    } else {
      setEditingExpenseId(null);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseDate(new Date().toISOString().substr(0, 10));
      // Reset logic: Start empty, let user toggle first payer to auto-fill
      setPayers({});
      // Default: All split
      setSplitters(new Set(trip?.participants.map(p => p.id) || []));
      setAdjustments({});
      setHasAdjustments(false);
    }
    setView('add_expense');
  };

  const handleDeleteExpense = (id: string) => {
    // Safer confirm check
    if (window.confirm("確定刪除此筆紀錄？")) {
      setTrip(prev => {
        if (!prev) return null;
        return {
          ...prev,
          expenses: prev.expenses.filter(e => e.id !== id)
        };
      });
      // Force exit to dashboard if we were editing this expense
      setView('dashboard');
    }
  };

  const handleSaveExpense = () => {
    if (!trip || !expenseTitle || !expenseAmount) return;

    const total = parseFloat(expenseAmount);
    
    // Validate Payers
    let currentPayers = Object.entries(payers)
        .map(([id, amount]) => ({ participantId: id, amount: parseFloat(amount as string) || 0 }))
        .filter(p => p.amount > 0);
    
    // Auto-fill logic backup: if 1 payer selected but amount is 0/invalid, set to total
    const payerIds = Object.keys(payers);
    if (payerIds.length === 1 && (currentPayers.length === 0 || Math.abs(currentPayers[0].amount - total) > 0.01)) {
        currentPayers = [{ participantId: payerIds[0], amount: total }];
    }

    const payerSum = currentPayers.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(payerSum - total) > 0.1) {
      alert(`付款總額 ($${payerSum}) 與消費金額 ($${total}) 不符`);
      return;
    }

    // Validate Splitters
    if (splitters.size === 0) {
      alert("至少需要一人分擔消費");
      return;
    }

    // Process Adjustments
    const validAdjustments = hasAdjustments 
        ? Object.entries(adjustments)
            .map(([id, amount]) => ({ participantId: id, amount: parseFloat(amount as string) || 0 }))
            .filter(a => a.amount > 0)
        : [];

    const newExpense: Expense = {
      id: editingExpenseId || generateId(),
      title: expenseTitle,
      totalAmount: total,
      date: editingExpenseId ? new Date(expenseDate).getTime() : Date.now(), 
      payers: currentPayers,
      splitters: Array.from(splitters),
      adjustments: validAdjustments,
    };

    setTrip({
      ...trip,
      expenses: editingExpenseId 
        ? trip.expenses.map(e => e.id === editingExpenseId ? newExpense : e)
        : [newExpense, ...trip.expenses] // Newest first
    });
    
    setView('dashboard');
  };

  // --- Smart Input Handlers ---

  const handlePayerToggle = (pid: string) => {
    const newPayers = { ...payers };
    if (newPayers[pid] !== undefined) {
      // Remove
      delete newPayers[pid];
      // If only one remains, the useEffect will handle syncing them to full amount
    } else {
      // Add
      const currentPayerIds = Object.keys(newPayers);
      if (currentPayerIds.length === 0) {
        // First person: Auto-fill with total amount immediately
        newPayers[pid] = expenseAmount;
      } else {
        // Second+ person: Add as 0 (waiting for split)
        newPayers[pid] = '0';
      }
    }
    setPayers(newPayers);
  };

  const handlePayerAmountChange = (id: string, valStr: string) => {
    const total = parseFloat(expenseAmount) || 0;
    const val = parseFloat(valStr);
    
    // 1. Update the target payer
    const newPayers = { ...payers, [id]: valStr };
    
    // 2. Smart Sync for exactly 2 payers
    const payerIds = Object.keys(newPayers);
    if (payerIds.length === 2 && !isNaN(val)) {
        const otherId = payerIds.find(pid => pid !== id);
        if (otherId) {
            const remainder = Math.max(0, total - val);
            newPayers[otherId] = remainder.toString();
        }
    }

    setPayers(newPayers);
  };

  const toggleSplitter = (pid: string) => {
    const newSet = new Set(splitters);
    if (newSet.has(pid)) {
        if (newSet.size > 1) newSet.delete(pid);
    } else {
        newSet.add(pid);
    }
    setSplitters(newSet);
  };

  // --- Render Functions ---

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-extrabold text-brand-600 tracking-tight">TripSplit AI</h1>
            <p className="text-gray-500 text-lg">極簡、快速的旅遊分帳工具</p>
          </div>
          
          <div className="bg-white p-8 rounded-3xl shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 ml-1">行程名稱</label>
              <input
                type="text"
                placeholder="例如：東京五日遊"
                className="w-full bg-gray-50 border-0 rounded-2xl px-4 py-3 text-lg focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-gray-300"
                value={newTripName}
                onChange={e => setNewTripName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 ml-1">參與夥伴</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newParticipants.map((p, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand-50 text-brand-700">
                    {p}
                    <button onClick={() => removeNewParticipant(i)} className="ml-2 hover:text-brand-900"><div className="text-lg leading-none">&times;</div></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="輸入名字後按 Enter"
                  className="flex-1 bg-gray-50 border-0 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-gray-300"
                  value={participantInput}
                  onChange={e => setParticipantInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addParticipant();
                  }}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                />
                <button 
                  onClick={addParticipant}
                  className="bg-brand-100 text-brand-600 p-3 rounded-2xl hover:bg-brand-200 transition-colors"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>

            <button
              onClick={handleCreateTrip}
              disabled={!newTripName || newParticipants.length === 0}
              className="w-full bg-brand-600 text-white py-4 rounded-2xl text-lg font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-50 disabled:shadow-none transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              建立行程
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'dashboard' && trip) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight truncate max-w-[90%]">
                {trip.name}
            </h1>
        </header>

        <main className="p-6 space-y-6 max-w-xl mx-auto">
          {/* Total Spent Card */}
          <div className="bg-brand-600 rounded-3xl p-6 text-white shadow-lg shadow-brand-200 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
             <p className="text-brand-100 text-sm font-medium mb-1">總消費金額</p>
             <div className="text-4xl font-bold tracking-tight">
               ${totalSpent.toLocaleString()}
             </div>
             
             {/* Mini Stats or Actions */}
             <div className="mt-6 flex gap-3">
                <button 
                   onClick={() => setIsAddingParticipant(true)}
                   className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-colors backdrop-blur-sm"
                >
                    <Plus size={16} />
                    新增參與者
                </button>
                <button 
                   onClick={() => setIsSettlementOpen(true)}
                   className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-colors backdrop-blur-sm"
                >
                    <Calculator size={16} />
                    結算
                </button>
             </div>
          </div>

          {/* Real-time Stats */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Receipt size={20} className="text-brand-500" />
                  即時統計
               </h2>
            </div>
            <div className="space-y-1">
              {balances.map(b => (
                <BalanceBar 
                  key={b.participantId}
                  participant={trip.participants.find(p => p.id === b.participantId)!}
                  balance={b}
                  maxVal={Math.max(...balances.map(x => Math.abs(x.net)))}
                />
              ))}
            </div>
          </div>

          {/* Expenses List */}
          <div>
            <div className="flex justify-between items-end mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">消費紀錄 (HISTORY)</h3>
            </div>
            
            <div className="space-y-3">
              {trip.expenses.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                    <Wallet size={48} className="mx-auto mb-3 text-gray-200" />
                    <p>還沒有消費紀錄</p>
                    <p className="text-sm mt-1">點擊下方按鈕開始記帳</p>
                </div>
              ) : (
                trip.expenses.map(exp => (
                <div 
                    key={exp.id} 
                    className="relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden isolate"
                >
                    {/* Content Section - Click to Edit */}
                    <div 
                        className="flex items-center p-4 pr-20 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => initExpenseForm(exp)}
                    >
                         <div className="flex items-center gap-4 min-w-0 overflow-hidden flex-1">
                            <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-bold shrink-0">
                                {exp.title.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-gray-900 truncate">{exp.title}</h4>
                                <p className="text-xs text-gray-500 truncate">
                                    {exp.payers.map(p => {
                                        const name = trip.participants.find(part => part.id === p.participantId)?.name;
                                        return name;
                                    }).join(', ')} 
                                    {exp.payers.length > 1 ? ' 合付' : ' 先付'}
                                </p>
                            </div>
                         </div>
                         <div className="text-right shrink-0">
                             <div className="font-bold text-gray-900 text-lg">${exp.totalAmount.toLocaleString()}</div>
                         </div>
                    </div>

                    {/* Delete Button - Positioned absolutely with high Z-index to avoid touch conflicts */}
                    <button
                        className="absolute right-0 top-0 bottom-0 w-16 bg-white border-l border-gray-100 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors z-50 cursor-pointer"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteExpense(exp.id);
                        }}
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
                ))
              )}
            </div>
          </div>
        </main>

        {/* Floating Action Button */}
        <div className="fixed bottom-8 left-0 right-0 flex justify-center z-40">
           <button 
             onClick={() => initExpenseForm()}
             className="bg-brand-600 text-white rounded-2xl px-8 py-4 shadow-xl shadow-brand-200 hover:bg-brand-700 transition-transform hover:-translate-y-1 active:translate-y-0 flex items-center gap-3 font-bold text-lg"
           >
              <Plus size={24} />
              記一筆
           </button>
        </div>

        {/* Add Participant Modal */}
        {isAddingParticipant && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">新增參與者</h3>
                    <input 
                        autoFocus
                        type="text" 
                        placeholder="輸入名字"
                        className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500"
                        value={newPartNameDashboard}
                        onChange={e => setNewPartNameDashboard(e.target.value)}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={() => setIsComposing(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddParticipantDashboard();
                        }}
                    />
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setIsAddingParticipant(false)}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200"
                        >
                            完成
                        </button>
                        <button 
                            onClick={handleAddParticipantDashboard}
                            className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700"
                        >
                            新增
                        </button>
                    </div>
                </div>
            </div>
        )}
        
        <SettlementModal 
            isOpen={isSettlementOpen}
            onClose={() => setIsSettlementOpen(false)}
            onEndTrip={() => {
                setTrip(null);
                setView('create');
                setIsSettlementOpen(false);
            }}
            trip={trip}
            balances={balances}
        />
      </div>
    );
  }

  if (view === 'add_expense' && trip) {
    const activePayersCount = Object.keys(payers).length;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100 sticky top-0 z-30">
          <button onClick={() => setView('dashboard')} className="text-gray-500 hover:text-gray-800">
             取消
          </button>
          <h2 className="text-lg font-bold text-gray-900">{editingExpenseId ? '編輯消費' : '新增消費'}</h2>
          <div className="w-8"></div> {/* Spacer */}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
          <div className="p-6 space-y-8 max-w-xl mx-auto">
            
            {/* Main Info */}
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1 block">消費內容</label>
                    <input
                        type="text"
                        placeholder="例如：午餐、車票"
                        className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-xl font-bold text-gray-900 placeholder:text-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                        value={expenseTitle}
                        onChange={e => setExpenseTitle(e.target.value)}
                    />
                </div>
                
                {/* Amount only, Date removed */}
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1 block">總金額</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                        <input
                            type="number"
                            placeholder="0"
                            className="w-full bg-white border border-gray-100 rounded-2xl pl-10 pr-5 py-4 text-xl font-bold text-gray-900 placeholder:text-gray-300 focus:ring-2 focus:ring-brand-500 transition-all"
                            value={expenseAmount}
                            onChange={e => setExpenseAmount(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Payers Section */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center justify-between">
                    <span>這筆誰付的？</span>
                    <span className="text-brand-600 bg-brand-50 px-2 py-0.5 rounded text-[10px]">
                        {activePayersCount === 1 ? '單人付款' : `${activePayersCount} 人分擔付款`}
                    </span>
                </label>
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                    {trip.participants.map(p => {
                        const isPayer = payers[p.id] !== undefined;
                        return (
                            <div 
                                key={p.id} 
                                className={`transition-colors ${isPayer ? 'bg-brand-50/30' : 'hover:bg-gray-50'}`}
                            >
                                <div 
                                    className="flex items-center p-4 cursor-pointer"
                                    onClick={() => handlePayerToggle(p.id)}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-all ${isPayer ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-200'}`}>
                                        {isPayer && <Check size={14} strokeWidth={3} />}
                                    </div>
                                    <span className={`font-medium flex-1 ${isPayer ? 'text-brand-900' : 'text-gray-600'}`}>{p.name}</span>
                                    
                                    {isPayer && (
                                        <div className="relative w-32" onClick={e => e.stopPropagation()}>
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-600 text-sm font-bold">$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-white border border-brand-200 rounded-lg py-2 pl-6 pr-3 text-right font-bold text-brand-700 focus:ring-2 focus:ring-brand-500"
                                                placeholder="0"
                                                value={payers[p.id]}
                                                onChange={e => handlePayerAmountChange(p.id, e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Splitters Section */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">誰需要出這筆錢？ (分母)</label>
                <div className="grid grid-cols-2 gap-3">
                    {trip.participants.map(p => {
                        const isSplitter = splitters.has(p.id);
                        return (
                            <button
                                key={p.id}
                                onClick={() => toggleSplitter(p.id)}
                                className={`flex items-center p-3 rounded-xl border transition-all ${
                                    isSplitter 
                                    ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm' 
                                    : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-2 ${isSplitter ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-200'}`}>
                                    {isSplitter && <Check size={12} strokeWidth={3} />}
                                </div>
                                <span className="font-bold">{p.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Extra Adjustments */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="font-bold text-gray-700">有人要多付嗎？ (Extra)</div>
                    <button 
                        onClick={() => setHasAdjustments(!hasAdjustments)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hasAdjustments ? 'bg-brand-600' : 'bg-gray-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hasAdjustments ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {hasAdjustments && (
                    <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 fade-in">
                        {trip.participants.map(p => (
                            <div key={p.id} className="flex items-center justify-between">
                                <span className="text-gray-600 font-medium">{p.name} 多付</span>
                                <div className="relative w-32">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-50 border-0 rounded-xl py-2 pl-6 pr-3 text-right font-bold text-gray-700 focus:ring-2 focus:ring-brand-500"
                                        placeholder="0"
                                        value={adjustments[p.id] || ''}
                                        onChange={e => setAdjustments({...adjustments, [p.id]: e.target.value})}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Editing mode extra actions */}
            {editingExpenseId && (
                <button
                    onClick={() => handleDeleteExpense(editingExpenseId)}
                    className="w-full py-4 text-red-500 font-bold bg-red-50 rounded-2xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                >
                    <Trash2 size={20} />
                    刪除此筆消費
                </button>
            )}

          </div>
        </div>

        {/* Fixed Bottom Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent z-40">
            <button
                onClick={handleSaveExpense}
                className="w-full bg-brand-900 text-white py-4 rounded-2xl text-lg font-bold shadow-lg shadow-brand-200 hover:bg-brand-800 transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
                <Check size={24} />
                儲存消費
            </button>
        </div>
      </div>
    );
  }

  return <div>Loading...</div>;
}