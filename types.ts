export type Page = 'Dashboard' | 'Transactions' | 'Reports' | 'Settings';

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
  uid: string; // The unique user ID from Firebase Auth
  displayName: string; // The display name, can be changed
  email?: string; // User's email address
  profilePicture?: string; // base64 encoded image (or URL from Firebase Storage)
}