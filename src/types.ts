export interface Participant {
  id: string;
  name: string;
}

export interface Payer {
  participantId: string;
  amount: number;
}

// How much EXTRA someone needs to pay on top of the split
export interface Adjustment {
  participantId: string;
  amount: number;
}

export interface Expense {
  id: string;
  title: string; // Consumption reason
  totalAmount: number;
  date: number;
  payers: Payer[]; // Who paid the bill (can be multiple)
  splitters: string[]; // IDs of people sharing the cost
  adjustments: Adjustment[]; // Who pays extra
}

export interface Trip {
  id: string;
  name: string;
  participants: Participant[];
  expenses: Expense[];
  createdAt: number;
}

export interface Balance {
  participantId: string;
  paid: number; // Total out of pocket
  consumed: number; // Total fair share
  net: number; // paid - consumed (Positive = owed to them, Negative = they owe)
}

export interface Settlement {
  from: string; // Payer Name
  to: string; // Receiver Name
  amount: number;
}