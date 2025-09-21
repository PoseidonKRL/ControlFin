export type Page = 'Dashboard' | 'Transactions' | 'Reports' | 'Settings' | 'Admin Panel';

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
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
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
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
  theme: 'galaxy' | 'minimalist';
}

export interface UserProfile {
  username: string; // The unique login identifier, cannot be changed
  displayName: string; // The display name, can be changed
  email: string; // User's email address
  profilePicture?: string; // base64 encoded image
  registeredAt: string; // ISO string
  isVerified: boolean; // Flag to check if email is verified
  verificationCode?: string; // Temporary code for verification or password reset
}
