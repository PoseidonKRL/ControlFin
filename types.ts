export type Page = 'Dashboard' | 'Transactions' | 'Reports' | 'Settings' | 'Admin Panel';

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export enum TransactionPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO string
  type: TransactionType;
  category: string;
  parentId?: string;
  subItems?: Transaction[];
  notes?: string;
  priority?: TransactionPriority;
}

export interface Category {
  id: string;
  name: string;
  // FIX: Made icon property required as application logic ensures it always has a value.
  icon: string;
}

export interface ChatMessage {
  sender: 'user' | 'finassist';
  text: string;
}

export interface UserData {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  chatHistory: ChatMessage[];
  theme: 'galaxy' | 'minimalist' | 'barbie';
}

export interface UserProfile {
  username: string; // The unique login identifier, cannot be changed
  displayName: string; // The display name, can be changed
  email?: string; // User's email address is now optional
  profilePicture?: string; // base64 encoded image
  registeredAt: string; // ISO string
}