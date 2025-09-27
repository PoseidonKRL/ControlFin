
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, Sector } from 'recharts';
import { UserData, Page, Transaction, TransactionType, Category, ChatMessage, UserProfile, TransactionPriority } from './types';
import { formatCurrency, processChartData, exportToCSV } from './utils/helpers';
import { getFinAssistResponse } from './services/geminiService';
import * as storageService from './services/storageService';
import { Modal, Button, Input, Select, Card, Spinner, ConfirmationModal, IconPickerModal } from './components/ui';
import { Icon, availableIcons } from './components/icons';
import { auth } from './services/firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, User } from 'firebase/auth';


// --- INITIAL DATA ---
const INITIAL_CATEGORIES: Category[] = [
    { id: 'cat1', name: 'Supermercado', icon: 'shopping_cart' },
    { id: 'cat2', name: 'Contas de Casa', icon: 'home' },
    { id: 'cat3', name: 'Aluguel', icon: 'key' },
    { id: 'cat4', name: 'Salário', icon: 'currency_dollar' },
    { id: 'cat5', name: 'Lazer', icon: 'puzzle_piece' },
];

const DEFAULT_USER_DATA: UserData = {
  transactions: [],
  categories: INITIAL_CATEGORIES,
  currency: 'BRL',
  chatHistory: [],
  theme: 'galaxy',
};

// --- Custom Hook for Animating Numbers ---
const useCountUp = (end: number, duration = 400) => {
    const [count, setCount] = useState(0);
    const frameRate = 1000 / 60;
    const totalFrames = Math.round(duration / frameRate);

    useEffect(() => {
        let frame = 0;
        // Start from 0 on each change of `end` value
        setCount(0); 
        const counter = setInterval(() => {
            frame++;
            const progress = frame / totalFrames;
            // Ease-out quad function for smoother animation
            const easeOutProgress = progress * (2 - progress);
            setCount(end * easeOutProgress);

            if (frame === totalFrames) {
                clearInterval(counter);
                setCount(end); // Ensure final value is exact
            }
        }, frameRate);
        return () => clearInterval(counter);
    }, [end, duration, frameRate, totalFrames]);
    
    return count;
};

// --- Custom Tooltip Components ---
const CustomBarTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string; currency: string; }> = ({ active, payload, label, currency }) => {
    if (active && payload && payload.length) {
        const income = payload.find(p => p.dataKey === 'Receita')?.value || 0;
        const expense = payload.find(p => p.dataKey === 'Despesa')?.value || 0;
        const balance = income - expense;

        const tooltipStyle: React.CSSProperties = {
            backgroundColor: 'var(--color-bg-glass)',
            border: `1px solid var(--color-border)`,
            backdropFilter: 'blur(5px)',
            borderRadius: '0.75rem',
            padding: '1rem',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        };
        
        return (
            <div style={tooltipStyle} className="text-sm">
                <p className="font-bold mb-2">{label}</p>
                <p className="flex justify-between items-center gap-4">
                    <span style={{ color: 'var(--color-success)' }}>Receita:</span>
                    <span className="font-semibold">{formatCurrency(income, currency)}</span>
                </p>
                <p className="flex justify-between items-center gap-4">
                    <span style={{ color: 'var(--color-danger)' }}>Despesa:</span>
                    <span className="font-semibold">{formatCurrency(expense, currency)}</span>
                </p>
                <hr className="my-2 border-[var(--color-border)]" />
                <p className="flex justify-between items-center gap-4 font-bold">
                    <span style={{ color: balance >= 0 ? 'var(--color-accent-secondary)' : 'var(--color-danger)' }}>
                        Saldo:
                    </span>
                    <span>{formatCurrency(balance, currency)}</span>
                </p>
            </div>
        );
    }
    return null;
};

const CustomPieTooltip: React.FC<{ active?: boolean; payload?: any[]; currency: string; }> = ({ active, payload, currency }) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        const { name, value, percent } = data;
        const color = data.color || data.fill;

        const tooltipStyle: React.CSSProperties = {
            backgroundColor: 'var(--color-bg-glass)',
            border: `1px solid var(--color-border)`,
            backdropFilter: 'blur(5px)',
            borderRadius: '0.75rem',
            padding: '1rem',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        };

        return (
            <div style={tooltipStyle} className="text-sm">
                <p className="font-bold mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                  {name}
                </p>
                <p className="flex justify-between items-center gap-4">
                    <span>Valor:</span>
                    <span className="font-semibold">{formatCurrency(value, currency)}</span>
                </p>
                <p className="flex justify-between items-center gap-4">
                    <span>Percentual:</span>
                    <span className="font-semibold">{(percent * 100).toFixed(2)}%</span>
                </p>
            </div>
        );
    }
    return null;
};

const CustomBalanceTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string; currency: string; }> = ({ active, payload, label, currency }) => {
    if (active && payload && payload.length) {
        const balance = payload[0].value;
        const color = payload[0].fill;

        const tooltipStyle: React.CSSProperties = {
            backgroundColor: 'var(--color-bg-glass)',
            border: `1px solid var(--color-border)`,
            backdropFilter: 'blur(5px)',
            borderRadius: '0.75rem',
            padding: '1rem',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        };

        return (
            <div style={tooltipStyle} className="text-sm">
                <p className="font-bold mb-2">{label}</p>
                <p className="flex justify-between items-center gap-4 font-bold">
                    <span style={{ color }}>Saldo:</span>
                    <span>{formatCurrency(balance, currency)}</span>
                </p>
            </div>
        );
    }
    return null;
};


// --- UI Components defined in the same file to reduce file count --- //

// --- LOGIN SCREEN ---
type AuthView = 'login' | 'register';

const LoginScreen: React.FC<{
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}> = ({ onLogin, onRegister }) => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  const clearFormState = () => {
    setError('');
    setIsLoading(false);
    setInfoMessage('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };
  
  const handleViewChange = (newView: AuthView) => {
    clearFormState();
    setView(newView);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setInfoMessage('');

    try {
      switch(view) {
        case 'login':
          await onLogin(email, password);
          break;
        case 'register':
          if (password !== confirmPassword) throw new Error("As senhas não coincidem.");
          if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
          await onRegister(email, password);
          // User is auto-logged in by parent component
          break;
      }
    } catch (err) {
      let errorMessage = 'Ocorreu um erro desconhecido.';
      if (err instanceof Error) {
        // Map Firebase error codes to user-friendly messages
        if ('code' in err) {
            switch ((err as any).code) {
                case 'auth/invalid-email':
                    errorMessage = 'O formato do e-mail é inválido.';
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage = 'E-mail ou senha inválidos.';
                    break;
                case 'auth/email-already-in-use':
                    errorMessage = 'Este e-mail já está em uso.';
                    break;
                default:
                    errorMessage = err.message;
            }
        } else {
            errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormContent = () => {
    switch (view) {
      case 'login':
        return (
          <>
            <h2 className="text-2xl font-bold">Login</h2>
            <Input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} />
            <Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} />
            <Button type="submit" variant="primary" disabled={isLoading}>{isLoading ? <Spinner /> : 'Entrar'}</Button>
            <div className="flex justify-center text-sm mt-4 text-slate-400">
              <p>Não tem uma conta? <button type="button" onClick={() => handleViewChange('register')} className="font-semibold text-purple-400 hover:text-purple-300">Cadastre-se</button></p>
            </div>
          </>
        );
      case 'register':
        return (
          <>
            <h2 className="text-2xl font-bold">Criar Conta</h2>
            <Input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} autoCapitalize="none" />
            <Input type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} />
            <Input type="password" placeholder="Confirmar Senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={isLoading} />
            <Button type="submit" variant="primary" disabled={isLoading}>{isLoading ? <Spinner /> : 'Cadastrar e Entrar'}</Button>
            <p className="text-sm mt-4 text-slate-400">Já tem uma conta? <button type="button" onClick={() => handleViewChange('login')} className="font-semibold text-purple-400 hover:text-purple-300">Faça o login</button></p>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 flex items-center justify-center">
      <div className="absolute inset-0 z-0 stars-bg"></div>
      <div className="absolute inset-0 z-10 stars-bg-medium"></div>
      <div className="absolute inset-0 z-20 stars-bg-fast"></div>
      <div className="relative z-30 flex flex-col items-center justify-center text-center text-white p-4 w-full max-w-sm">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-4 animate-fade-in">
          ControlFin
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-slate-300 mb-12 animate-fade-in-delay">Sua galáxia de finanças pessoais.</p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full animate-fade-in-delay">
          {error && <p className="text-red-400 text-sm p-3 bg-red-900/50 rounded-lg">{error}</p>}
          {infoMessage && <p className="text-cyan-300 text-sm p-3 bg-cyan-900/50 rounded-lg">{infoMessage}</p>}
          {renderFormContent()}
        </form>
      </div>
      <style>{`
        @keyframes move-stars { from { background-position: 0 0; } to { background-position: -10000px 5000px; } }
        .stars-bg { background-image: url('https://www.transparenttextures.com/patterns/stardust.png'); animation: move-stars 200s linear infinite; }
        .stars-bg-medium { background-image: url('https://www.transparenttextures.com/patterns/stardust.png'); animation: move-stars 100s linear infinite; }
        .stars-bg-fast { background-image: url('https://www.transparenttextures.com/patterns/stardust.png'); animation: move-stars 50s linear infinite; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 1s ease-out forwards; }
        .animate-fade-in-delay { animation: fade-in 1s 0.3s ease-out forwards; opacity: 0; }
      `}</style>
    </div>
  );
};


// --- HEADER ---
const Header: React.FC<{ pageTitle: string; onMenuClick: () => void }> = ({ pageTitle, onMenuClick }) => (
    <header className="md:hidden sticky top-0 bg-[var(--color-bg-primary)]/70 backdrop-blur-lg z-30 p-4 flex items-center gap-4 border-b border-[var(--color-border)]">
      <button onClick={onMenuClick} className="text-[var(--color-text-primary)]" aria-label="Open menu">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
      </button>
      <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{pageTitle}</h1>
    </header>
);

// --- SIDEBAR ---
const Sidebar: React.FC<{
    currentPage: Page;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    userProfile: UserProfile;
    isOpen: boolean;
}> = ({ currentPage, onNavigate, onLogout, userProfile, isOpen }) => {
    const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
        { page: 'Dashboard', label: 'Painel', icon: <Icon name="home" className="h-6 w-6" /> },
        { page: 'Transactions', label: 'Transações', icon: <Icon name="credit_card" className="h-6 w-6" /> },
        { page: 'Reports', label: 'Relatórios', icon: <Icon name="book_open" className="h-6 w-6" /> },
        { page: 'Settings', label: 'Configurações', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    ];

    return (
        <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-64 bg-[var(--color-bg-primary)]/80 backdrop-blur-lg border-r border-[var(--color-border)] flex flex-col p-4 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-out`}>
            <div className="flex items-center gap-3 mb-10">
                {userProfile.profilePicture ? (
                    <img src={userProfile.profilePicture} alt="Foto de perfil" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center font-bold text-slate-900 text-lg">
                        {userProfile.displayName.charAt(0).toUpperCase()}
                    </div>
                )}
                <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{userProfile.displayName}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Bem-vindo(a) de volta</p>
                </div>
            </div>
            <nav className="flex-grow space-y-2">
                {navItems.map(({ page, label, icon }) => {
                    const isActive = currentPage === page;
                    return (
                        <button
                            key={page}
                            onClick={() => onNavigate(page)}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left text-lg transition-colors relative ${
                                isActive
                                    ? 'bg-purple-600/20 text-white font-semibold'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
                            }`}
                        >
                            {isActive && <div className="absolute left-0 top-2 bottom-2 w-1 bg-[var(--color-accent-secondary)] rounded-r-full"></div>}
                            {icon}
                            <span>{label}</span>
                        </button>
                    )
                })}
            </nav>
            <Button onClick={onLogout} variant="secondary" className="mt-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sair
            </Button>
        </aside>
    );
};

// --- TRANSACTION MODAL ---
const TransactionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (transaction: Omit<Transaction, 'id' | 'subItems'>, parentId?: string) => void;
    categories: Category[];
    currency: string;
    editingTransaction?: Transaction | null;
    parentId?: string;
}> = ({ isOpen, onClose, onSave, categories, currency, editingTransaction, parentId }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
    const [category, setCategory] = useState(categories[0]?.name || '');
    const [notes, setNotes] = useState('');
    const [priority, setPriority] = useState<TransactionPriority>(TransactionPriority.MEDIUM);
    
    const isSubItem = !!parentId || !!editingTransaction?.parentId;
    const hasSubItems = !!editingTransaction?.subItems?.length;

    useEffect(() => {
        if (editingTransaction) {
            setDescription(editingTransaction.description);
            setAmount(editingTransaction.amount);
            setDate(new Date(editingTransaction.date).toISOString().slice(0, 10));
            setType(editingTransaction.type);
            setCategory(editingTransaction.category);
            setNotes(editingTransaction.notes || '');
            setPriority(editingTransaction.priority || TransactionPriority.MEDIUM);
        } else {
            // Reset form for new transaction
            setDescription('');
            setAmount('');
            setDate(new Date().toISOString().slice(0, 10));
            setType(TransactionType.EXPENSE);
            setCategory(categories[0]?.name || '');
            setNotes('');
            setPriority(TransactionPriority.MEDIUM);
        }
    }, [editingTransaction, isOpen, categories]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (description && amount !== '' && date && category) {
            onSave({
                description,
                amount: hasSubItems ? editingTransaction!.amount : +amount,
                date: new Date(date).toISOString(),
                type,
                category,
                parentId: editingTransaction?.parentId || parentId,
                notes,
                priority,
            });
            onClose();
        }
    };

    const incomeCategories = useMemo(() => categories.filter(c => c.name.toLowerCase().includes('salário') || c.name.toLowerCase().includes('freelance')), [categories]);
    const expenseCategories = useMemo(() => categories.filter(c => !incomeCategories.map(ic => ic.name).includes(c.name)), [categories, incomeCategories]);
    
    const relevantCategories = type === TransactionType.INCOME ? incomeCategories : expenseCategories;
    
    useEffect(() => {
        if (!relevantCategories.find(c => c.name === category)) {
            setCategory(relevantCategories[0]?.name || '');
        }
    }, [type, relevantCategories, category]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingTransaction ? 'Editar Transação' : (isSubItem ? 'Adicionar Subitem' : 'Adicionar Transação')}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Descrição" value={description} onChange={e => setDescription(e.target.value)} required />
                {!hasSubItems ? (
                     <Input label={`Valor (${currency})`} type="number" step="0.01" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} required />
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Valor ({currency})</label>
                        <p className="w-full bg-[var(--color-bg-primary)] border-2 border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-secondary)]">
                           {formatCurrency(editingTransaction!.amount, currency)} (Soma dos subitens)
                        </p>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    <Select label="Prioridade" value={priority} onChange={e => setPriority(e.target.value as TransactionPriority)}>
                        <option value={TransactionPriority.HIGH}>Alta</option>
                        <option value={TransactionPriority.MEDIUM}>Média</option>
                        <option value={TransactionPriority.LOW}>Baixa</option>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Select label="Tipo" value={type} onChange={e => setType(e.target.value as TransactionType)}>
                        <option value={TransactionType.EXPENSE}>Despesa</option>
                        <option value={TransactionType.INCOME}>Receita</option>
                    </Select>
                     <Select label="Categoria" value={category} onChange={e => setCategory(e.target.value)} required>
                        {relevantCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                     </Select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Anotação/Observação (opcional)</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Ex: 5kg de arroz, 2L de leite..."
                        className="w-full bg-transparent border-2 border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-0 focus:border-[var(--color-accent)] transition-all"
                        rows={2}
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" variant="primary">Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

// --- DASHBOARD ---
const Dashboard: React.FC<{ 
    userData: UserData;
    selectedMonth: string;
    onMonthChange: (month: string) => void;
    availableMonths: string[];
    formatMonthYear: (month: string) => string;
}> = ({ userData, selectedMonth, onMonthChange, availableMonths, formatMonthYear }) => {
    const { transactions, currency, theme } = userData;
    const { incomeVsExpenseData } = processChartData(transactions);

    const filteredTransactions = useMemo(() => {
        if (selectedMonth === 'all') {
            return transactions;
        }
        return transactions.filter(t => t.date.startsWith(selectedMonth));
    }, [transactions, selectedMonth]);

    const totalIncome = filteredTransactions.filter(t => t.type === TransactionType.INCOME && !t.parentId).reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE && !t.parentId).reduce((sum, t) => sum + t.amount, 0);
    const balance = totalIncome - totalExpense;

    const animatedIncome = useCountUp(totalIncome);
    const animatedExpense = useCountUp(totalExpense);
    const animatedBalance = useCountUp(balance);

    const chartColors = {
        barSuccess: 'var(--color-success)',
        barDanger: 'var(--color-danger)',
        text: 'var(--color-text-secondary)',
        legend: 'var(--color-text-primary)',
    };

    const cardGradient = {
        galaxy: {
            success: "from-green-500/20 to-transparent",
            danger: "from-red-500/20 to-transparent",
            accent: "from-cyan-500/20 to-transparent",
        },
        minimalist: { success: "", danger: "", accent: "" },
        barbie: {
            success: "from-emerald-500/20 to-transparent",
            danger: "from-rose-500/20 to-transparent",
            accent: "from-cyan-500/20 to-transparent",
        }
    }[theme];

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Painel</h1>
                {availableMonths.length > 0 && (
                    <div className="w-full sm:w-auto sm:max-w-xs">
                        <Select
                            value={selectedMonth}
                            onChange={(e) => onMonthChange(e.target.value)}
                            aria-label="Filtrar por mês"
                            icon={<Icon name="calendar" className="w-5 h-5" />}
                        >
                            <option value="all">Todos os Meses</option>
                            {availableMonths.map(month => (
                                <option key={month} value={month}>
                                    {formatMonthYear(month)}
                                </option>
                            ))}
                        </Select>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className={`bg-gradient-to-br ${cardGradient.success}`}>
                    <h3 className="text-[var(--color-text-secondary)] text-lg">Receita Total</h3>
                    <p className="text-3xl md:text-4xl font-bold text-[var(--color-success)]">{formatCurrency(animatedIncome, currency)}</p>
                </Card>
                <Card className={`bg-gradient-to-br ${cardGradient.danger}`}>
                    <h3 className="text-[var(--color-text-secondary)] text-lg">Despesa Total</h3>
                    <p className="text-3xl md:text-4xl font-bold text-[var(--color-danger)]">{formatCurrency(animatedExpense, currency)}</p>
                </Card>
                <Card className={`bg-gradient-to-br ${cardGradient.accent}`}>
                    <h3 className="text-[var(--color-text-secondary)] text-lg">Saldo Líquido</h3>
                    <p className={`text-3xl md:text-4xl font-bold ${balance >= 0 ? 'text-[var(--color-accent-secondary)]' : 'text-orange-400'}`}>{formatCurrency(animatedBalance, currency)}</p>
                </Card>
            </div>
            <Card>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Receitas vs Despesas Mensais</h2>
                <div className="h-80 md:h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={incomeVsExpenseData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
                            <XAxis dataKey="name" stroke={chartColors.text} angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                            <YAxis stroke={chartColors.text} tickFormatter={(value) => formatCurrency(value as number, currency)} />
                            <Tooltip
                                cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }}
                                content={<CustomBarTooltip currency={currency} />}
                            />
                            <Legend wrapperStyle={{ color: chartColors.legend }} />
                            <Bar dataKey="Receita" fill={chartColors.barSuccess} radius={[4, 4, 0, 0]} animationDuration={800} />
                            <Bar dataKey="Despesa" fill={chartColors.barDanger} radius={[4, 4, 0, 0]} animationDuration={800} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
};

// --- TRANSACTIONS PAGE ---
const PriorityIndicator: React.FC<{ priority?: TransactionPriority }> = ({ priority = TransactionPriority.MEDIUM }) => {
    const priorityConfig = {
        [TransactionPriority.HIGH]: { color: 'var(--color-danger)', text: 'Alta' },
        [TransactionPriority.MEDIUM]: { color: 'var(--color-warning)', text: 'Média' },
        [TransactionPriority.LOW]: { color: 'var(--color-accent-secondary)', text: 'Baixa' },
    };
    const { color, text } = priorityConfig[priority];
    return (
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} title={`Prioridade: ${text}`}></div>
    );
};

const TransactionsPage: React.FC<{
    transactions: Transaction[];
    categories: Category[];
    currency: string;
    onAddTransaction: (parentId?: string) => void;
    onEditTransaction: (transaction: Transaction) => void;
    onDeleteTransaction: (transactionId: string) => void;
    onShowNote: (note: string) => void;
    selectedMonth: string;
    onMonthChange: (month: string) => void;
    availableMonths: string[];
    formatMonthYear: (month: string) => string;
}> = ({
    transactions,
    categories,
    currency,
    onAddTransaction,
    onEditTransaction,
    onDeleteTransaction,
    onShowNote,
    selectedMonth,
    onMonthChange,
    availableMonths,
    formatMonthYear
}) => {
    
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [sortBy, setSortBy] = useState('date-desc');

    const filteredTransactions = useMemo(() => {
        if (selectedMonth === 'all') {
            return transactions;
        }
        return transactions.filter(t => t.date.startsWith(selectedMonth));
    }, [transactions, selectedMonth]);

    const sortedParentTransactions = useMemo(() => {
        const parentTransactions = filteredTransactions.filter(t => !t.parentId);
        const priorityOrder: Record<TransactionPriority, number> = {
            [TransactionPriority.HIGH]: 3,
            [TransactionPriority.MEDIUM]: 2,
            [TransactionPriority.LOW]: 1,
        };

        return [...parentTransactions].sort((a, b) => {
            switch (sortBy) {
                case 'priority-desc':
                    const priorityA = priorityOrder[a.priority || TransactionPriority.MEDIUM] ?? 0;
                    const priorityB = priorityOrder[b.priority || TransactionPriority.MEDIUM] ?? 0;
                    return priorityB - priorityA;
                case 'amount-desc':
                    return b.amount - a.amount;
                case 'amount-asc':
                    return a.amount - b.amount;
                case 'date-asc':
                    return new Date(a.date).getTime() - new Date(b.date).getTime();
                case 'date-desc':
                default:
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
            }
        });
    }, [filteredTransactions, sortBy]);

    const toggleExpand = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderTransactionRow = (t: Transaction, isSubItem: boolean = false) => {
        const category = categories.find(c => c.name === t.category);
        const hasSubItems = t.subItems && t.subItems.length > 0;
        const isExpanded = expanded[t.id];
        const typeBorderColor = t.type === TransactionType.INCOME ? 'border-[var(--color-success)]' : 'border-[var(--color-danger)]';

        return (
            <React.Fragment key={t.id}>
                <tr className={`border-b border-[var(--color-border)] ${!isSubItem ? 'bg-[var(--color-bg-secondary)]' : 'bg-[var(--color-bg-primary)]'}`}>
                    <td className={`py-3 px-4 border-l-4 ${typeBorderColor} ${isSubItem ? 'pl-12' : ''}`}>
                        <div className="flex items-center gap-3">
                            {!isSubItem && hasSubItems && (
                                <button onClick={() => toggleExpand(t.id)} className="p-1 rounded-full hover:bg-[var(--color-border)]">
                                     <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            )}
                             {!isSubItem && !hasSubItems && <div className="w-6"></div>}
                            <div className="flex items-center gap-3">
                                <span className="p-2 bg-[var(--color-border)] rounded-lg">
                                    <Icon name={category?.icon} className="h-5 w-5" />
                                </span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <PriorityIndicator priority={t.priority} />
                                        <p className="font-medium text-[var(--color-text-primary)]">{t.description}</p>
                                        {t.notes && (
                                            <button 
                                                onClick={() => onShowNote(t.notes!)} 
                                                title="Ver anotação" 
                                                className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                                                aria-label="Ver anotação"
                                            >
                                                <Icon name="document_text" className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-[var(--color-text-secondary)]">{t.category}</p>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--color-text-secondary)] hidden lg:table-cell">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                    <td className={`py-3 px-4 text-right font-semibold ${t.type === TransactionType.INCOME ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                        {t.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(t.amount, currency)}
                    </td>
                    <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                           {!isSubItem && (
                             <Button variant="secondary" className="p-2" onClick={() => onAddTransaction(t.id)} title="Adicionar Subitem">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                             </Button>
                           )}
                            <Button variant="secondary" className="p-2" onClick={() => onEditTransaction(t)} title="Editar">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                            </Button>
                            <Button variant="danger" className="p-2" onClick={() => onDeleteTransaction(t.id)} title="Excluir">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </Button>
                        </div>
                    </td>
                </tr>
                {!isSubItem && hasSubItems && isExpanded && (
                    <>
                        {t.subItems!.map(subItem => renderTransactionRow(subItem, true))}
                    </>
                )}
            </React.Fragment>
        );
    };

    const renderTransactionCard = (t: Transaction, isSubItem: boolean = false) => {
        const category = categories.find(c => c.name === t.category);
        const hasSubItems = t.subItems && t.subItems.length > 0;
        const isExpanded = expanded[t.id];
        const typeBgColor = t.type === TransactionType.INCOME ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]';

        return (
            <React.Fragment key={t.id}>
                <Card className={`p-0 overflow-hidden relative ${isSubItem ? 'ml-4' : ''}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${typeBgColor}`}></div>
                    <div className="p-4 ml-1.5">
                        <div className="flex justify-between items-start gap-3">
                             <div className="flex items-center gap-3 flex-grow min-w-0">
                                <span className="p-2 bg-[var(--color-border)] rounded-lg self-start">
                                    <Icon name={category?.icon} className="h-5 w-5" />
                                </span>
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2">
                                        <PriorityIndicator priority={t.priority} />
                                        <p className="font-medium text-[var(--color-text-primary)] break-words">{t.description}</p>
                                        {t.notes && (
                                            <button onClick={() => onShowNote(t.notes!)} title="Ver anotação" className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors flex-shrink-0" aria-label="Ver anotação">
                                                <Icon name="document_text" className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-[var(--color-text-secondary)]">{t.category}</p>
                                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                            <p className={`text-lg font-semibold ${t.type === TransactionType.INCOME ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'} whitespace-nowrap`}>
                                {t.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(t.amount, currency)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 p-2 bg-[var(--color-bg-secondary)]/50">
                        {!isSubItem && (
                            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onAddTransaction(t.id)} title="Adicionar Subitem">
                                <Icon name="plus" className="h-4 w-4"/>
                                <span className="hidden sm:inline">Subitem</span>
                            </Button>
                        )}
                        {!isSubItem && hasSubItems && (
                            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => toggleExpand(t.id)}>
                                {isExpanded ? 'Ocultar' : `Ver Itens (${t.subItems?.length})`}
                            </Button>
                        )}
                        <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onEditTransaction(t)} title="Editar">
                            <Icon name="pencil" className="w-4 h-4"/>
                            <span className="hidden sm:inline">Editar</span>
                        </Button>
                        <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => onDeleteTransaction(t.id)} title="Excluir">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </Button>
                    </div>
                </Card>
                {!isSubItem && hasSubItems && isExpanded && (
                    <div className="space-y-3">
                        {t.subItems!.map(subItem => renderTransactionCard(subItem, true))}
                    </div>
                )}
            </React.Fragment>
        );
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Transações</h1>
                <div className="flex w-full sm:w-auto items-center gap-4">
                    <div className="flex-grow">
                         <Select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            aria-label="Ordenar por"
                            className="w-full"
                        >
                            <option value="date-desc">Data (Mais Recente)</option>
                            <option value="date-asc">Data (Mais Antiga)</option>
                            <option value="priority-desc">Prioridade (Alta {'>'} Baixa)</option>
                            <option value="amount-desc">Valor (Maior)</option>
                            <option value="amount-asc">Valor (Menor)</option>
                        </Select>
                    </div>
                    <Button onClick={() => onAddTransaction()} variant="primary" className="whitespace-nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        <span className="hidden sm:inline">Adicionar</span>
                    </Button>
                </div>
            </div>

            {availableMonths.length > 0 && (
                <div className="w-full sm:w-auto sm:max-w-xs">
                     <Select
                        value={selectedMonth}
                        onChange={(e) => onMonthChange(e.target.value)}
                        aria-label="Filtrar por mês"
                        className="w-full"
                        icon={<Icon name="calendar" className="w-5 h-5" />}
                    >
                        <option value="all">Todos os Meses</option>
                        {availableMonths.map(month => (
                            <option key={month} value={month}>
                                {formatMonthYear(month)}
                            </option>
                        ))}
                    </Select>
                </div>
            )}
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {sortedParentTransactions.length > 0 ? (
                    sortedParentTransactions.map(t => renderTransactionCard(t))
                ) : (
                    <Card className="text-center p-8 text-[var(--color-text-secondary)] flex flex-col items-center gap-4">
                        <Icon name="archive_box" className="w-16 h-16 text-[var(--color-border)]" />
                        <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">Nenhuma transação encontrada</h3>
                        <p>Comece adicionando uma nova despesa ou receita.</p>
                        <Button onClick={() => onAddTransaction()} variant="primary" className="mt-4">
                            <Icon name="plus" className="h-5 w-5" /> Adicionar Transação
                        </Button>
                    </Card>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto bg-[var(--color-bg-glass)] border border-[var(--color-border)] rounded-xl">
                 <table className="min-w-full text-sm">
                    <thead className="border-b border-[var(--color-border)]">
                        <tr>
                            <th className="text-left font-semibold text-[var(--color-text-secondary)] p-4">Descrição</th>
                            <th className="text-left font-semibold text-[var(--color-text-secondary)] p-4 hidden lg:table-cell">Data</th>
                            <th className="text-right font-semibold text-[var(--color-text-secondary)] p-4">Valor</th>
                            <th className="text-right font-semibold text-[var(--color-text-secondary)] p-4">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedParentTransactions.length > 0 ? (
                           sortedParentTransactions.map(t => renderTransactionRow(t))
                        ) : (
                            <tr>
                                <td colSpan={4}>
                                    <div className="text-center p-8 text-[var(--color-text-secondary)] flex flex-col items-center gap-4">
                                        <Icon name="archive_box" className="w-16 h-16 text-[var(--color-border)]" />
                                        <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">Nenhuma transação encontrada</h3>
                                        <p>Comece adicionando uma nova despesa ou receita.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- REPORTS PAGE ---
const ReportsPage: React.FC<{ userData: UserData }> = ({ userData }) => {
    const { transactions, currency, theme } = userData;
    const { expenseByCategoryData, monthlyBalanceData } = processChartData(transactions);
    const [activeIndex, setActiveIndex] = useState(0);
    const [animateCharts, setAnimateCharts] = useState(false);

    // Trigger animation on data change
    useEffect(() => {
        // Only trigger if there's data to avoid animation on initial empty load
        if (transactions.length > 0) {
            setAnimateCharts(true);
            const timer = setTimeout(() => setAnimateCharts(false), 1200); // Duration of the CSS animation
            return () => clearTimeout(timer);
        }
    }, [transactions]);

    const onPieEnter = useCallback((_: any, index: number) => {
        setActiveIndex(index);
    }, []);
    
    const chartColors = {
        galaxy: ['#9333ea', '#3b82f6', '#10b981', '#f97316', '#ef4444', '#6366f1', '#d946ef', '#0ea5e9'],
        minimalist: ['#2563eb', '#16a34a', '#db2777', '#f59e0b', '#dc2626', '#4f46e5', '#9333ea', '#0284c7'],
        barbie: ['#e5007a', '#0891b2', '#db2777', '#f472b6', '#831843', '#22d3ee', '#c026d3', '#0ea5e9'],
    }[theme];

    const chartText = 'var(--color-text-secondary)';
    
    const renderActiveShape = (props: any) => {
      const RADIAN = Math.PI / 180;
      const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
      const sin = Math.sin(-RADIAN * midAngle);
      const cos = Math.cos(-RADIAN * midAngle);
      const sx = cx + (outerRadius + 10) * cos;
      const sy = cy + (outerRadius + 10) * sin;
      const mx = cx + (outerRadius + 30) * cos;
      const my = cy + (outerRadius + 30) * sin;
      const ex = mx + (cos >= 0 ? 1 : -1) * 22;
      const ey = my;
      const textAnchor = cos >= 0 ? 'start' : 'end';

      return (
        <g>
          <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-bold text-lg">
            {payload.name}
          </text>
          <Sector
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            startAngle={startAngle}
            endAngle={endAngle}
            fill={fill}
          />
          <Sector
            cx={cx}
            cy={cy}
            startAngle={startAngle}
            endAngle={endAngle}
            innerRadius={outerRadius + 6}
            outerRadius={outerRadius + 10}
            fill={fill}
          />
          <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
          <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
          <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill={chartText} className="text-sm">{`${formatCurrency(value, currency)}`}</text>
          <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill={chartText} className="text-xs">
            {`(${(percent * 100).toFixed(2)}%)`}
          </text>
        </g>
      );
    };

    return (
        <div className="p-4 md:p-8 space-y-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Relatórios</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <Card className={animateCharts ? 'animate-chart-update' : ''}>
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Despesas por Categoria</h2>
                    {expenseByCategoryData.length > 0 ? (
                        <div className="h-96 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip content={<CustomPieTooltip currency={currency} />} />
                                    <Pie
                                        // @ts-ignore -- The @types/recharts package has incorrect typings for this prop.
                                        activeIndex={activeIndex}
                                        activeShape={renderActiveShape}
                                        data={expenseByCategoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={110}
                                        fill="#8884d8"
                                        dataKey="value"
                                        onMouseEnter={onPieEnter}
                                        animationDuration={1200}
                                        // FIX: Added @ts-ignore for animationEasing prop due to overly restrictive types in recharts.
                                        // @ts-ignore
                                        animationEasing="cubic-bezier(0.25, 1, 0.5, 1)"
                                    >
                                        {expenseByCategoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-center p-8 text-[var(--color-text-secondary)]">Não há dados de despesas para exibir.</p>
                    )}
                </Card>
                <Card className={animateCharts ? 'animate-chart-update' : ''}>
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Evolução do Saldo Mensal</h2>
                     {monthlyBalanceData.length > 0 ? (
                        <div className="h-96">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyBalanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis dataKey="name" stroke={chartText} />
                                    <YAxis 
                                        stroke={chartText} 
                                        tickFormatter={(value) => formatCurrency(value as number, currency)} 
                                        width={80}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }}
                                        content={<CustomBalanceTooltip currency={currency} />}
                                    />
                                    <Bar
                                        dataKey="Saldo"
                                        animationDuration={1200}
                                        // FIX: Added @ts-ignore for animationEasing prop due to overly restrictive types in recharts.
                                        // @ts-ignore
                                        animationEasing="cubic-bezier(0.25, 1, 0.5, 1)"
                                    >
                                        {monthlyBalanceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.Saldo >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                     ) : (
                        <p className="text-center p-8 text-[var(--color-text-secondary)]">Não há dados de saldo para exibir.</p>
                     )}
                </Card>
            </div>
            <div className="flex justify-end">
                <Button onClick={() => exportToCSV(transactions, currency)} variant="secondary">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Exportar para CSV
                </Button>
            </div>
        </div>
    );
};

// --- SETTINGS PAGE ---
const SettingsPage: React.FC<{
    userData: UserData;
    onUpdateSettings: (newSettings: Partial<UserData>) => void;
    userProfile: UserProfile;
    onUpdateProfile: (newProfile: Partial<Omit<UserProfile, 'uid'>>) => Promise<void>;
}> = ({ userData, onUpdateSettings, userProfile, onUpdateProfile }) => {
    const [currency, setCurrency] = useState(userData.currency);
    const [theme, setTheme] = useState(userData.theme);
    const [displayName, setDisplayName] = useState(userProfile.displayName);
    const [profilePic, setProfilePic] = useState(userProfile.profilePicture);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        setDisplayName(userProfile.displayName);
        setProfilePic(userProfile.profilePicture);
        setCurrency(userData.currency);
        setTheme(userData.theme);
    }, [userProfile, userData]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        onUpdateSettings({ currency, theme });
        await onUpdateProfile({ displayName, profilePicture: profilePic });
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
    };
    
    const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // In a real app, you'd upload this to Firebase Storage and get a URL.
            // For simplicity, we'll continue using base64, which can be stored in Firestore/Auth.
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePic(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    return (
        <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Configurações</h1>
            
            <Card>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-4 mb-6">Perfil do Usuário</h2>
                <div className="flex flex-col md:flex-row items-start gap-8">
                    <div className="flex-shrink-0">
                         <div className="relative w-32 h-32">
                             {profilePic ? (
                                <img src={profilePic} alt="Foto de perfil" className="w-full h-full rounded-full object-cover" />
                             ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center font-bold text-slate-900 text-5xl">
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                             )}
                             <button 
                                 onClick={() => fileInputRef.current?.click()}
                                 className="absolute bottom-0 right-0 p-2 bg-[var(--color-accent)] text-white rounded-full hover:bg-[var(--color-accent-hover)] transition-colors"
                                 title="Alterar foto de perfil"
                             >
                                <Icon name="photo" className="w-5 h-5"/>
                             </button>
                             <input type="file" ref={fileInputRef} onChange={handleProfilePicChange} accept="image/*" className="hidden" />
                         </div>
                    </div>
                    <div className="flex-grow space-y-4 w-full">
                        <Input label="Nome de Exibição" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">E-mail</label>
                            <p className="w-full bg-transparent border-2 border-transparent rounded-lg px-3 py-2 text-[var(--color-text-secondary)]">
                                {userProfile.email} (não pode ser alterado)
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-4 mb-6">Preferências do Aplicativo</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select label="Moeda" value={currency} onChange={e => setCurrency(e.target.value)}>
                        <option value="BRL">Real Brasileiro (R$)</option>
                        <option value="USD">Dólar Americano ($)</option>
                        <option value="EUR">Euro (€)</option>
                    </Select>
                    <Select label="Tema Visual" value={theme} onChange={e => setTheme(e.target.value as 'galaxy' | 'minimalist' | 'barbie')}>
                        <option value="galaxy">Galáxia</option>
                        <option value="minimalist">Minimalista</option>
                        <option value="barbie">Barbie</option>
                    </Select>
                </div>
            </Card>
            
             <div className="flex justify-end pt-4">
                <Button onClick={handleSave} variant="primary" disabled={isSaving || saveSuccess} className="w-40">
                    {isSaving ? <Spinner /> : saveSuccess ? <><Icon name="check" /> Salvo!</> : 'Salvar Alterações'}
                </Button>
            </div>
        </div>
    );
};

// --- FINASSIST (AI CHAT) ---
const FinAssist: React.FC<{ 
    chatHistory: ChatMessage[]; 
    onSendMessage: (message: string) => Promise<void>; 
    isThinking: boolean;
}> = ({ chatHistory, onSendMessage, isThinking }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleSend = () => {
        if (input.trim() && !isThinking) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-40">
            <details className="group">
                <summary className="list-none flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-full text-white cursor-pointer shadow-2xl shadow-purple-500/30 transform transition-all duration-300 group-open:h-[28rem] group-open:rounded-2xl group-open:items-start group-open:w-[calc(100vw-3rem)] group-open:max-w-sm sm:group-open:w-80">
                    <div className="transition-opacity duration-200 group-open:opacity-0 group-open:hidden">
                        <Icon name="sparkles" className="h-8 w-8" />
                    </div>
                    <div className="absolute top-0 left-0 w-full opacity-0 transition-opacity duration-300 delay-200 group-open:opacity-100 flex flex-col h-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl">
                         <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
                            <h3 className="font-bold text-lg">FinAssist</h3>
                            <label htmlFor="finassist-toggle" className="cursor-pointer text-[var(--color-text-secondary)] hover:text-white p-1">&times;</label>
                        </div>
                        <div className="flex-grow p-3 space-y-4 overflow-y-auto">
                            {chatHistory.map((msg, index) => (
                                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-xs md:max-w-sm rounded-2xl px-4 py-2 ${msg.sender === 'user' ? 'bg-[var(--color-accent)] text-white rounded-br-none' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] rounded-bl-none'}`}>
                                        <p className="text-sm" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br />') }} />
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="max-w-xs md:max-w-sm rounded-2xl px-4 py-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] rounded-bl-none">
                                        <div className="flex items-center gap-2">
                                            <Spinner />
                                            <span className="text-sm">Pensando...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-3 border-t border-[var(--color-border)]">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Pergunte algo..."
                                    className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                                    disabled={isThinking}
                                />
                                <button onClick={handleSend} disabled={isThinking} className="p-2 bg-[var(--color-accent)] rounded-lg text-white disabled:opacity-50">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </summary>
            </details>
        </div>
    );
};

// --- PWA INSTALL PROMPT FOR IOS ---
const IOSInstallPrompt: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        // @ts-ignore - 'standalone' is a non-standard property for iOS Safari
        const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

        if (isIOS && !isInStandaloneMode) {
            const lastPromptTime = localStorage.getItem('iosInstallPromptDismissed');
            // Show prompt if it has never been shown or if it has been more than 3 days
            const threeDays = 3 * 24 * 60 * 60 * 1000;
            if (!lastPromptTime || (new Date().getTime() - Number(lastPromptTime)) > threeDays) {
                // Show after a small delay to not be intrusive
                setTimeout(() => setIsVisible(true), 2000);
            }
        }
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('iosInstallPromptDismissed', new Date().getTime().toString());
        setIsVisible(false);
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-[var(--color-bg-glass)]/95 backdrop-blur-lg text-[var(--color-text-primary)] p-4 rounded-xl shadow-2xl z-50 flex items-center gap-4 animate-slide-up border border-[var(--color-border)]">
            <img src="logo.svg" alt="ControlFin Logo" className="w-14 h-14 rounded-lg flex-shrink-0"/>
            <div className="flex-grow">
                <p className="font-bold">Instale o ControlFin no seu aparelho!</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    É rápido e fácil. Toque no ícone de 
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 inline-block mx-1 align-bottom">
                        <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                    </svg>
                    e depois em "Adicionar à Tela de Início".
                </p>
            </div>
            <button onClick={handleDismiss} className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] self-start flex-shrink-0" aria-label="Fechar prompt de instalação">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <style>{`
                @keyframes slide-up {
                    from { transform: translate(-50%, 100px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
            `}</style>
        </div>
    );
};


// --- MAIN APP ---
const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userData, setUserData] = useState<UserData>(DEFAULT_USER_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const [isTxModalOpen, setTxModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [subItemParentId, setSubItemParentId] = useState<string | undefined>(undefined);
  
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [noteToShow, setNoteToShow] = useState('');

  const [isFinAssistThinking, setFinAssistThinking] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState('all');

  // --- AUTH LOGIC ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setIsLoading(true);
        if (user) {
            const data = await storageService.getUserData(user.uid);
            const profile: UserProfile = {
                uid: user.uid,
                displayName: user.displayName || user.email!.split('@')[0],
                email: user.email!,
                profilePicture: user.photoURL || undefined,
            };
            
            if (data) {
                setUserData(data);
                document.documentElement.setAttribute('data-theme', data.theme);
            } else {
                // New user registration, create their data doc
                const newUserData = { ...DEFAULT_USER_DATA, categories: [...INITIAL_CATEGORIES] };
                await storageService.saveUserData(user.uid, newUserData);
                setUserData(newUserData);
                document.documentElement.setAttribute('data-theme', newUserData.theme);
            }
            setCurrentUser(profile);
        } else {
            setCurrentUser(null);
            setUserData(DEFAULT_USER_DATA);
        }
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  const handleRegister = async (email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, {
      displayName: email.split('@')[0]
    });
    // The onAuthStateChanged listener will handle setting user data
  };
  
  const handleLogin = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // The onAuthStateChanged listener will handle login state
  };
  
  const handleLogout = async () => {
    await signOut(auth);
  };
  
  // --- DATA SYNC WRAPPER ---
  const updateAndSaveUserData = (updater: (current: UserData) => UserData) => {
    setUserData(prev => {
        const newState = updater(prev);
        if (currentUser) {
            storageService.saveUserData(currentUser.uid, newState);
        }
        return newState;
    });
  };
  
  // --- TRANSACTIONS LOGIC ---
  const handleSaveTransaction = (transactionData: Omit<Transaction, 'id' | 'subItems'>) => {
    updateAndSaveUserData(prev => {
      let newTransactions = [...prev.transactions];

      if (editingTransaction) { // --- UPDATE ---
        newTransactions = newTransactions.map(t => {
            if (t.id === editingTransaction.id) {
                return { ...t, ...transactionData };
            }
            if (t.subItems?.some(st => st.id === editingTransaction.id)) {
                return {
                    ...t,
                    subItems: t.subItems.map(st => st.id === editingTransaction.id ? { ...st, ...transactionData } : st)
                }
            }
            return t;
        });
      } else { // --- CREATE ---
        const newTransaction: Transaction = {
          ...transactionData,
          id: `tx_${Date.now()}_${Math.random()}`,
        };
        
        if (transactionData.parentId) {
            newTransactions = newTransactions.map(t => 
                t.id === transactionData.parentId
                    ? { ...t, subItems: [...(t.subItems || []), newTransaction] }
                    : t
            );
        } else {
            newTransactions.push(newTransaction);
        }
      }
      
      newTransactions = newTransactions.map(t => {
          if (t.subItems && t.subItems.length > 0) {
              const newAmount = t.subItems.reduce((sum, item) => sum + item.amount, 0);
              return { ...t, amount: newAmount };
          }
          return t;
      });
      
      return { ...prev, transactions: newTransactions };
    });

    setEditingTransaction(null);
  };

  const handleOpenTxModal = (transaction?: Transaction | null, parentId?: string) => {
      setEditingTransaction(transaction || null);
      setSubItemParentId(parentId);
      setTxModalOpen(true);
  };
  
  const handleDeleteTransaction = (transactionId: string) => {
      setTransactionToDelete(transactionId);
      setDeleteModalOpen(true);
  };

  const confirmDeleteTransaction = () => {
    if (transactionToDelete) {
      updateAndSaveUserData(prev => {
        let newTransactions = [...prev.transactions];
        newTransactions = newTransactions.filter(t => t.id !== transactionToDelete);
        
        newTransactions = newTransactions.map(t => {
          if (t.subItems) {
            const filteredSubItems = t.subItems.filter(st => st.id !== transactionToDelete);
            if (filteredSubItems.length < t.subItems.length) {
              const newAmount = filteredSubItems.reduce((sum, item) => sum + item.amount, 0);
              return { ...t, subItems: filteredSubItems, amount: newAmount };
            }
          }
          return t;
        });
        
        return { ...prev, transactions: newTransactions };
      });
    }
    setDeleteModalOpen(false);
    setTransactionToDelete(null);
  };
  
  // --- CATEGORIES LOGIC ---
  const handleSaveCategory = (categoryData: Omit<Category, 'id'>, id?: string) => {
    updateAndSaveUserData(prev => {
        const newCategories = [...prev.categories];
        if (id) {
            const index = newCategories.findIndex(c => c.id === id);
            if (index !== -1) newCategories[index] = { ...newCategories[index], ...categoryData };
        } else {
            newCategories.push({ ...categoryData, id: `cat_${Date.now()}` });
        }
        return { ...prev, categories: newCategories };
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
      updateAndSaveUserData(prev => {
          if (prev.transactions.some(t => prev.categories.find(c => c.id === categoryId)?.name === t.category)) {
              alert("Não é possível excluir uma categoria que está sendo usada em transações.");
              return prev;
          }
          const newCategories = prev.categories.filter(c => c.id !== categoryId);
          return { ...prev, categories: newCategories };
      });
  };

  // --- SETTINGS/PROFILE LOGIC ---
  const handleUpdateSettings = (newSettings: Partial<UserData>) => {
      updateAndSaveUserData(prev => ({...prev, ...newSettings}));
      document.documentElement.setAttribute('data-theme', newSettings.theme || userData.theme);
  };
  
  const handleUpdateProfile = async (newProfile: Partial<Omit<UserProfile, 'uid'>>) => {
      if (!currentUser || !auth.currentUser) return;
      
      await updateProfile(auth.currentUser, {
        displayName: newProfile.displayName,
        photoURL: newProfile.profilePicture,
      });

      setCurrentUser(prev => ({
        ...prev!,
        displayName: newProfile.displayName || prev!.displayName,
        profilePicture: newProfile.profilePicture,
      }));
  };
  
  // --- FINASSIST LOGIC ---
  const handleFinAssistSend = async (message: string) => {
    const newMessage: ChatMessage = { sender: 'user', text: message };
    
    // Optimistically update UI
    setUserData(prev => ({...prev, chatHistory: [...prev.chatHistory, newMessage]}));
    setFinAssistThinking(true);
    
    try {
        const responseText = await getFinAssistResponse(message, userData.chatHistory, userData.transactions);
        const assistMessage: ChatMessage = { sender: 'finassist', text: responseText };
        updateAndSaveUserData(prev => ({ ...prev, chatHistory: [...prev.chatHistory, assistMessage]}));
    } catch (error) {
        console.error("FinAssist Error:", error);
        const errorMessage: ChatMessage = { sender: 'finassist', text: "Desculpe, não consegui processar sua solicitação no momento." };
        updateAndSaveUserData(prev => ({ ...prev, chatHistory: [...prev.chatHistory, errorMessage]}));
    } finally {
        setFinAssistThinking(false);
    }
  };
  
  // --- DERIVED STATE / HELPERS ---
  const availableMonths = useMemo(() => {
    const months = new Set(userData.transactions.map(t => t.date.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [userData.transactions]);
  
  const formatMonthYear = (month: string) => {
      const [year, monthNum] = month.split('-');
      const formattedDate = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('pt-BR', {
          month: 'long',
          year: 'numeric',
      });
      return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  };

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth) && selectedMonth !== 'all') {
      setSelectedMonth('all');
    }
  }, [availableMonths, selectedMonth]);

  const renderPage = () => {
    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard 
                  userData={userData} 
                  selectedMonth={selectedMonth} 
                  onMonthChange={setSelectedMonth}
                  availableMonths={availableMonths}
                  formatMonthYear={formatMonthYear}
               />;
      case 'Transactions':
        return <TransactionsPage 
                  transactions={userData.transactions}
                  categories={userData.categories}
                  currency={userData.currency}
                  onAddTransaction={(parentId) => handleOpenTxModal(null, parentId)}
                  onEditTransaction={(t) => handleOpenTxModal(t)}
                  onDeleteTransaction={handleDeleteTransaction}
                  onShowNote={(note) => { setNoteToShow(note); setNoteModalOpen(true); }}
                  selectedMonth={selectedMonth} 
                  onMonthChange={setSelectedMonth}
                  availableMonths={availableMonths}
                  formatMonthYear={formatMonthYear}
                />;
      case 'Reports':
        return <ReportsPage userData={userData} />;
      case 'Settings':
        return <SettingsPage 
                  userData={userData} 
                  onUpdateSettings={handleUpdateSettings} 
                  userProfile={currentUser!} 
                  onUpdateProfile={handleUpdateProfile}
               />;
      default:
        return <div>Página não encontrada</div>;
    }
  };
  
  if (isLoading) {
      return (
        <div className="w-screen h-screen bg-[var(--color-bg-primary)] flex flex-col items-center justify-center">
            <Spinner />
            <p className="mt-4 text-[var(--color-text-secondary)]">Carregando...</p>
        </div>
      );
  }

  if (!currentUser) {
    return <LoginScreen 
             onLogin={handleLogin} 
             onRegister={handleRegister}
           />;
  }

  return (
    <div className="flex h-screen bg-[var(--color-bg-primary)]">
      <Sidebar 
          currentPage={currentPage} 
          onNavigate={(page) => { setCurrentPage(page); setSidebarOpen(false); }} 
          onLogout={handleLogout}
          userProfile={currentUser}
          isOpen={isSidebarOpen}
      />
      <div 
        onClick={() => setSidebarOpen(false)} 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ease-in-out ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      ></div>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Header pageTitle={currentPage} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1">
          <div key={currentPage} className="animate-page-transition">
            {renderPage()}
          </div>
        </main>
      </div>

      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setTxModalOpen(false)}
        onSave={handleSaveTransaction}
        categories={userData.categories}
        currency={userData.currency}
        editingTransaction={editingTransaction}
        parentId={subItemParentId}
      />
      
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteTransaction}
        title="Confirmar Exclusão"
        confirmText="Excluir"
        confirmVariant="danger"
      >
        Você tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
      </ConfirmationModal>

      <Modal isOpen={isNoteModalOpen} onClose={() => setNoteModalOpen(false)} title="Anotação">
         <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">{noteToShow}</p>
         <div className="flex justify-end pt-4">
            <Button onClick={() => setNoteModalOpen(false)} variant="primary">Fechar</Button>
         </div>
      </Modal>

      <FinAssist 
        chatHistory={userData.chatHistory} 
        onSendMessage={handleFinAssistSend}
        isThinking={isFinAssistThinking}
      />

      <IOSInstallPrompt />
    </div>
  );
};

export default App;