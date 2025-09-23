
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, Sector } from 'recharts';
import { UserData, Page, Transaction, TransactionType, Category, ChatMessage, UserProfile } from './types';
import { formatCurrency, processChartData, exportToCSV } from './utils/helpers';
import { getFinAssistResponse } from './services/geminiService';
import * as storageService from './services/storageService';
import { Modal, Button, Input, Select, Card, Spinner, ConfirmationModal, IconPickerModal } from './components/ui';
import { Icon, availableIcons } from './components/icons';

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


// --- UI Components defined in the same file to reduce file count --- //

// --- LOGIN SCREEN ---
type AuthView = 'login' | 'register' | 'forgotPassword' | 'resetPassword' | 'verifyEmail';

const LoginScreen: React.FC<{
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, email: string) => Promise<string>;
  onVerifyEmail: (username: string, code: string) => Promise<void>;
  onForgotPassword: (email: string) => Promise<string | null>;
  onResetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}> = ({ onLogin, onRegister, onVerifyEmail, onForgotPassword, onResetPassword }) => {
  const [view, setView] = useState<AuthView>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  
  // These states hold data between view transitions
  const [userToVerify, setUserToVerify] = useState<string | null>(null); 
  const [emailToReset, setEmailToReset] = useState<string | null>(null);

  const clearFormState = () => {
    setError('');
    setIsLoading(false);
    setInfoMessage('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setCode('');
    // keep email for convenience if switching between login/register
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
          await onLogin(username, password);
          break;
        case 'register':
          if (password !== confirmPassword) throw new Error("As senhas não coincidem.");
          if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
          const verificationCode = await onRegister(username, password, email);
          setUserToVerify(username); // Store username for verification step
          setInfoMessage(`Em uma aplicação real, este código seria enviado para ${email}. Para esta demonstração, seu código é: ${verificationCode}`);
          setView('verifyEmail');
          break;
        case 'verifyEmail':
          if (!userToVerify) throw new Error("Sessão de verificação inválida. Tente se cadastrar novamente.");
          await onVerifyEmail(userToVerify, code);
          break;
        case 'forgotPassword':
            const resetCode = await onForgotPassword(email);
            if (resetCode) {
              setEmailToReset(email);
              setInfoMessage(`Um código de recuperação foi gerado para ${email}. Em uma aplicação real, ele seria enviado por e-mail. Seu código é: ${resetCode}`);
              setView('resetPassword');
            } else {
              throw new Error("E-mail não encontrado.");
            }
            break;
        case 'resetPassword':
            if (!emailToReset) throw new Error("Sessão de recuperação inválida.");
            if (password !== confirmPassword) throw new Error("As novas senhas não coincidem.");
            if (password.length < 6) throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
            await onResetPassword(emailToReset, code, password);
            setInfoMessage("Senha redefinida com sucesso! Você já pode fazer o login.");
            handleViewChange('login');
            break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
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
            <Input type="text" placeholder="Usuário" value={username} onChange={e => setUsername(e.target.value)} required disabled={isLoading} />
            <Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} />
            <Button type="submit" variant="primary" disabled={isLoading}>{isLoading ? <Spinner /> : 'Entrar'}</Button>
            <div className="flex justify-between text-sm mt-4 text-slate-400">
              <p>Não tem uma conta? <button type="button" onClick={() => handleViewChange('register')} className="font-semibold text-purple-400 hover:text-purple-300">Cadastre-se</button></p>
              <button type="button" onClick={() => handleViewChange('forgotPassword')} className="font-semibold text-purple-400 hover:text-purple-300">Esqueceu a senha?</button>
            </div>
          </>
        );
      case 'register':
        return (
          <>
            <h2 className="text-2xl font-bold">Criar Conta</h2>
            <Input type="text" placeholder="Usuário" value={username} onChange={e => setUsername(e.target.value)} required disabled={isLoading} autoCapitalize="none" />
            <Input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} />
            <Input type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} />
            <Input type="password" placeholder="Confirmar Senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={isLoading} />
            <Button type="submit" variant="primary" disabled={isLoading}>{isLoading ? <Spinner /> : 'Cadastrar'}</Button>
            <p className="text-sm mt-4 text-slate-400">Já tem uma conta? <button type="button" onClick={() => handleViewChange('login')} className="font-semibold text-purple-400 hover:text-purple-300">Faça o login</button></p>
          </>
        );
      case 'verifyEmail':
        return (
            <>
              <h2 className="text-2xl font-bold">Verificar E-mail</h2>
              <p className="text-slate-300 text-sm">Um código de verificação foi gerado para @{userToVerify}.</p>
              <Input type="text" placeholder="Código de 6 dígitos" value={code} onChange={e => setCode(e.target.value)} required disabled={isLoading} maxLength={6} />
              <Button type="submit" variant="primary" disabled={isLoading}>{isLoading ? <Spinner /> : 'Verificar e Entrar'}</Button>
              <p className="text-sm mt-4 text-slate-400">Voltar para o <button type="button" onClick={() => handleViewChange('login')} className="font-semibold text-purple-400 hover:text-purple-300">Login</button></p>
            </>
        );
      case 'forgotPassword':
        return (
          <>
            <h2 className="text-2xl font-bold">Recuperar Senha</h2>
            <Input type="email" placeholder="Seu e-mail cadastrado" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} />
            <Button type="submit" variant="primary" disabled={isLoading}>{isLoading ? <Spinner /> : 'Enviar Código'}</Button>
            <p className="text-sm mt-4 text-slate-400">Voltar para o <button type="button" onClick={() => handleViewChange('login')} className="font-semibold text-purple-400 hover:text-purple-300">Login</button></p>
          </>
        );
      case 'resetPassword':
        return (
          <>
            <h2 className="text-2xl font-bold">Redefinir Senha</h2>
            <p className="text-slate-300 text-sm">Insira o código enviado para {emailToReset} e defina uma nova senha.</p>
            <Input type="text" placeholder="Código de 6 dígitos" value={code} onChange={e => setCode(e.target.value)} required disabled={isLoading} maxLength={6} />
            <Input type="password" placeholder="Nova Senha (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} />
            <Input type="password" placeholder="Confirmar Nova Senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={isLoading} />
            <Button type="submit" variant="primary" disabled={isLoading}>{isLoading ? <Spinner /> : 'Redefinir Senha'}</Button>
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
    <header className="md:hidden sticky top-0 bg-[var(--color-bg-primary)]/70 backdrop-blur-md z-30 p-4 flex items-center gap-4 border-b border-[var(--color-border)]">
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
    const navItems: { page: Page; label: string; icon: React.ReactNode, adminOnly?: boolean }[] = [
        { page: 'Dashboard', label: 'Painel', icon: <Icon name="home" className="h-6 w-6" /> },
        { page: 'Transactions', label: 'Transações', icon: <Icon name="credit_card" className="h-6 w-6" /> },
        { page: 'Reports', label: 'Relatórios', icon: <Icon name="book_open" className="h-6 w-6" /> },
        { page: 'Settings', label: 'Configurações', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        { page: 'Admin Panel', label: 'Painel Admin', icon: <Icon name="shield_check" className="h-6 w-6" />, adminOnly: true }
    ];

    return (
        <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-64 bg-[var(--color-bg-primary)]/80 backdrop-blur-lg border-r border-[var(--color-border)] flex flex-col p-4 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out`}>
            <div className="flex items-center gap-3 mb-10">
                {userProfile.profilePicture ? (
                    <img src={userProfile.profilePicture} alt="Foto de perfil" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center font-bold text-slate-900 text-lg">
                        {userProfile.displayName.charAt(0)}
                    </div>
                )}
                <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{userProfile.displayName}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Bem-vindo(a) de volta</p>
                </div>
            </div>
            <nav className="flex-grow">
                {navItems.map(({ page, label, icon, adminOnly }) => {
                    if (adminOnly && userProfile.username !== 'admin') return null;
                    return (
                        <button
                            key={page}
                            onClick={() => onNavigate(page)}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left text-lg transition-colors ${
                                currentPage === page
                                    ? 'bg-[var(--color-accent)] text-white font-semibold shadow-lg'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
                            }`}
                        >
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
        } else {
            // Reset form for new transaction
            setDescription('');
            setAmount('');
            setDate(new Date().toISOString().slice(0, 10));
            setType(TransactionType.EXPENSE);
            setCategory(categories[0]?.name || '');
            setNotes('');
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
                notes: isSubItem ? notes : undefined,
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
                        <p className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-secondary)]">
                           {formatCurrency(editingTransaction!.amount, currency)} (Soma dos subitens)
                        </p>
                    </div>
                )}
                <Input label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                <Select label="Tipo" value={type} onChange={e => setType(e.target.value as TransactionType)}>
                    <option value={TransactionType.EXPENSE}>Despesa</option>
                    <option value={TransactionType.INCOME}>Receita</option>
                </Select>
                 <Select label="Categoria" value={category} onChange={e => setCategory(e.target.value)} required>
                    {relevantCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                 </Select>
                 {isSubItem && (
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Anotação/Observação</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Ex: 5kg de arroz, 2L de leite..."
                            className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
                            rows={3}
                        />
                    </div>
                )}
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

    const chartColors = {
        barSuccess: theme === 'galaxy' ? '#4ade80' : '#16a34a',
        barDanger: theme === 'galaxy' ? '#f87171' : '#ef4444',
        text: theme === 'galaxy' ? '#94a3b8' : '#6b7280',
    };
    
    const tooltipColors = {
        background: theme === 'galaxy' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        border: theme === 'galaxy' ? '#475569' : '#e5e7eb',
        label: theme === 'galaxy' ? '#e2e8f0' : '#1f2937',
        legend: theme === 'galaxy' ? '#cbd5e1' : '#4b5563',
    };

    const cardGradient = theme === 'galaxy' 
        ? {
            success: "from-green-500/20 to-slate-800/50",
            danger: "from-red-500/20 to-slate-800/50",
            accent: "from-purple-500/20 to-slate-800/50",
          }
        : { success: "", danger: "", accent: "" };

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
                    <p className="text-3xl md:text-4xl font-bold text-[var(--color-success)]">{formatCurrency(totalIncome, currency)}</p>
                </Card>
                <Card className={`bg-gradient-to-br ${cardGradient.danger}`}>
                    <h3 className="text-[var(--color-text-secondary)] text-lg">Despesa Total</h3>
                    <p className="text-3xl md:text-4xl font-bold text-[var(--color-danger)]">{formatCurrency(totalExpense, currency)}</p>
                </Card>
                <Card className={`bg-gradient-to-br ${cardGradient.accent}`}>
                    <h3 className="text-[var(--color-text-secondary)] text-lg">Saldo Líquido</h3>
                    <p className={`text-3xl md:text-4xl font-bold ${balance >= 0 ? 'text-cyan-400' : 'text-orange-400'}`}>{formatCurrency(balance, currency)}</p>
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
                                contentStyle={{
                                    backgroundColor: tooltipColors.background,
                                    borderColor: tooltipColors.border,
                                    backdropFilter: 'blur(4px)',
                                    borderRadius: '0.75rem',
                                }}
                                labelStyle={{ color: tooltipColors.label }}
                                itemStyle={{ fontWeight: 'bold' }}
                                formatter={(value: number) => formatCurrency(value, currency)}
                            />
                            <Legend wrapperStyle={{ color: tooltipColors.legend }} />
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

    const filteredTransactions = useMemo(() => {
        if (selectedMonth === 'all') {
            return transactions;
        }
        return transactions.filter(t => t.date.startsWith(selectedMonth));
    }, [transactions, selectedMonth]);

    const toggleExpand = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderTransactionRow = (t: Transaction, isSubItem: boolean = false) => {
        const category = categories.find(c => c.name === t.category);
        const hasSubItems = t.subItems && t.subItems.length > 0;
        const isExpanded = expanded[t.id];

        return (
            <React.Fragment key={t.id}>
                <tr className={`border-b border-[var(--color-border)] ${!isSubItem ? 'bg-[var(--color-bg-secondary)]' : 'bg-[var(--color-bg-secondary)]/50'}`}>
                    <td className={`py-3 px-4 ${isSubItem ? 'pl-12' : ''}`}>
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
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-medium text-[var(--color-text-primary)]">{t.description}</p>
                                        {isSubItem && t.notes && (
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
                    <td className="py-3 px-4 text-[var(--color-text-secondary)]">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
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

    return (
        <div className="p-4 md:p-8 space-y-6">
             <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Transações</h1>
                <div className="flex items-center gap-4">
                    {availableMonths.length > 0 && (
                        <div className="w-full sm:w-auto sm:max-w-xs">
                             <Select
                                value={selectedMonth}
                                onChange={(e) => onMonthChange(e.target.value)}
                                aria-label="Filtrar por mês"
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
                    <Button onClick={() => onAddTransaction()} variant="primary" className="whitespace-nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Adicionar
                    </Button>
                </div>
            </div>
            
            <div className="overflow-x-auto bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
                 <table className="min-w-full text-sm">
                    <thead className="border-b border-[var(--color-border)]">
                        <tr>
                            <th className="text-left font-semibold text-[var(--color-text-secondary)] p-4">Descrição</th>
                            <th className="text-left font-semibold text-[var(--color-text-secondary)] p-4">Data</th>
                            <th className="text-right font-semibold text-[var(--color-text-secondary)] p-4">Valor</th>
                            <th className="text-right font-semibold text-[var(--color-text-secondary)] p-4">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTransactions.filter(t => !t.parentId).length > 0 ? (
                           filteredTransactions.filter(t => !t.parentId).map(t => renderTransactionRow(t))
                        ) : (
                            <tr>
                                <td colSpan={4} className="text-center p-8 text-[var(--color-text-secondary)]">
                                    Nenhuma transação encontrada para este período.
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

    const onPieEnter = useCallback((_: any, index: number) => {
        setActiveIndex(index);
    }, []);
    
    const chartColors = theme === 'galaxy' 
        ? ['#9333ea', '#3b82f6', '#10b981', '#f97316', '#ef4444', '#6366f1', '#d946ef', '#0ea5e9']
        : ['#2563eb', '#16a34a', '#db2777', '#f59e0b', '#dc2626', '#4f46e5', '#9333ea', '#0284c7'];
        
    const chartText = theme === 'galaxy' ? '#94a3b8' : '#6b7280';
    
    const tooltipColors = {
        background: theme === 'galaxy' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        border: theme === 'galaxy' ? '#475569' : '#e5e7eb',
        label: theme === 'galaxy' ? '#e2e8f0' : '#1f2937',
    };

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
                 <Card>
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Despesas por Categoria</h2>
                    {expenseByCategoryData.length > 0 ? (
                        <div className="h-96 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    {/* FIX: The @types/recharts package may have incorrect typings for the Pie component,
                                        missing the 'activeIndex' prop. Using @ts-ignore to bypass this typing issue,
                                        as the component works as expected at runtime with this prop. */}
                                    {/* @ts-ignore */}
                                    <Pie
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
                <Card>
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Evolução do Saldo Mensal</h2>
                     {monthlyBalanceData.length > 0 ? (
                        <div className="h-96">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyBalanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis dataKey="name" stroke={chartText} />
                                    <YAxis stroke={chartText} tickFormatter={(value) => formatCurrency(value as number, currency)} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: tooltipColors.background,
                                            borderColor: tooltipColors.border,
                                            backdropFilter: 'blur(4px)',
                                            borderRadius: '0.75rem',
                                        }}
                                        labelStyle={{ color: tooltipColors.label }}
                                        formatter={(value: number) => [formatCurrency(value, currency), 'Saldo']}
                                    />
                                    <Bar dataKey="Saldo" animationDuration={800}>
                                        {monthlyBalanceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.Saldo >= 0 ? chartColors[2] : chartColors[4]} />
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
    onUpdateProfile: (newProfile: Partial<UserProfile>) => void;
}> = ({ userData, onUpdateSettings, userProfile, onUpdateProfile }) => {
    const [currency, setCurrency] = useState(userData.currency);
    const [theme, setTheme] = useState(userData.theme);
    const [displayName, setDisplayName] = useState(userProfile.displayName);
    const [email, setEmail] = useState(userProfile.email);
    const [profilePic, setProfilePic] = useState(userProfile.profilePicture);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const handleSave = () => {
        onUpdateSettings({ currency, theme });
        onUpdateProfile({ displayName, email, profilePicture: profilePic });
        // In a real app, you'd show a success toast/message
        alert('Configurações salvas!');
    };
    
    const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
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
                                    {displayName.charAt(0)}
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
                        <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Usuário</label>
                            <p className="w-full bg-[var(--color-bg-primary)] border border-transparent rounded-lg px-3 py-2 text-[var(--color-text-secondary)]">
                                @{userProfile.username} (não pode ser alterado)
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
                    <Select label="Tema Visual" value={theme} onChange={e => setTheme(e.target.value as 'galaxy' | 'minimalist')}>
                        <option value="galaxy">Galáxia</option>
                        <option value="minimalist">Minimalista</option>
                    </Select>
                </div>
            </Card>
            
             <div className="flex justify-end pt-4">
                <Button onClick={handleSave} variant="primary">
                    Salvar Alterações
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
                <summary className="list-none flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-full text-white cursor-pointer shadow-2xl shadow-purple-500/30 transform transition-all duration-300 group-open:w-80 group-open:h-[28rem] group-open:rounded-2xl group-open:items-start">
                    <div className="transition-opacity duration-200 group-open:opacity-0 group-open:hidden">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
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

const AdminPanel: React.FC<{
  onDeleteUser: (username: string) => void;
  onResetUser: (username:string) => void;
}> = ({ onDeleteUser, onResetUser }) => {

  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToReset, setUserToReset] = useState<string | null>(null);

  const allUsers = storageService.getAllProfiles();
  const allPasswords = storageService.getAllPasswords();

  const handleDeleteUser = () => {
    if (userToDelete) {
      onDeleteUser(userToDelete);
      setUserToDelete(null);
    }
  };
  
  const handleResetUser = () => {
    if (userToReset) {
      onResetUser(userToReset);
      setUserToReset(null);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Painel do Administrador</h1>

        <Card>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Gerenciamento de Usuários</h2>
             <div className="overflow-x-auto">
                 <table className="min-w-full text-sm">
                    <thead className="border-b border-[var(--color-border)]">
                        <tr>
                            <th className="text-left font-semibold text-[var(--color-text-secondary)] p-4">Usuário</th>
                            <th className="text-left font-semibold text-[var(--color-text-secondary)] p-4">Nome de Exibição</th>
                            <th className="text-left font-semibold text-[var(--color-text-secondary)] p-4">E-mail</th>
                            <th className="text-center font-semibold text-[var(--color-text-secondary)] p-4">Verificado</th>
                            <th className="text-right font-semibold text-[var(--color-text-secondary)] p-4">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(allUsers).map(([username, profile]: [string, UserProfile]) => {
                          if (username === 'admin') return null; // Can't edit admin
                          return (
                            <tr key={username} className="border-b border-[var(--color-border)]">
                                <td className="p-4 font-mono text-[var(--color-text-secondary)]">@{username}</td>
                                <td className="p-4 text-[var(--color-text-primary)]">{profile.displayName}</td>
                                <td className="p-4 text-[var(--color-text-secondary)]">{profile.email}</td>
                                <td className="p-4 text-center">
                                    {profile.isVerified 
                                      ? <Icon name="check" className="h-5 w-5 text-green-400 mx-auto" /> 
                                      : <Icon name="x_mark" className="h-5 w-5 text-red-400 mx-auto" />}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end items-center gap-2">
                                        <Button 
                                          variant="secondary" 
                                          onClick={() => setUserToReset(username)}
                                          title="Resetar Dados do Usuário"
                                          className="p-2"
                                        >
                                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 4l16 16" /></svg>
                                        </Button>
                                        <Button 
                                          variant="danger" 
                                          onClick={() => setUserToDelete(username)}
                                          title="Excluir Usuário"
                                          className="p-2"
                                        >
                                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                          )
                        })}
                    </tbody>
                 </table>
             </div>
        </Card>
        
        <ConfirmationModal
            isOpen={!!userToDelete}
            onClose={() => setUserToDelete(null)}
            onConfirm={handleDeleteUser}
            title="Confirmar Exclusão de Usuário"
            confirmText="Excluir"
            confirmVariant="danger"
        >
          Você tem certeza que deseja excluir permanentemente o usuário <strong>@{userToDelete}</strong> e todos os seus dados? Esta ação não pode ser desfeita.
        </ConfirmationModal>
        
        <ConfirmationModal
            isOpen={!!userToReset}
            onClose={() => setUserToReset(null)}
            onConfirm={handleResetUser}
            title="Confirmar Reset de Dados"
            confirmText="Resetar Dados"
            confirmVariant="danger"
        >
          Você tem certeza que deseja apagar TODAS as transações, categorias e histórico de chat do usuário <strong>@{userToReset}</strong>? A conta do usuário será mantida, mas seus dados financeiros serão resetados para o padrão.
        </ConfirmationModal>

    </div>
  );
}


// --- MAIN APP ---
const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userData, setUserData] = useState<UserData>(DEFAULT_USER_DATA);
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
  const [showIOSInstallPrompt, setShowIOSInstallPrompt] = useState(false);

  // Load user from session storage on mount
  useEffect(() => {
    const loggedInUser = sessionStorage.getItem('controlFin_currentUser');
    if (loggedInUser) {
      const profile = storageService.getAllProfiles()[loggedInUser];
      const data = storageService.getUserData(loggedInUser);
      if (profile && data) {
        setCurrentUser(profile);
        setUserData(data);
        document.documentElement.setAttribute('data-theme', data.theme);
      }
    }
  }, []);
  
  // --- AUTH LOGIC ---
  
  const handleRegister = async (username: string, password: string, email: string): Promise<string> => {
    const allProfiles = storageService.getAllProfiles();
    if (allProfiles[username]) {
      throw new Error("Este nome de usuário já existe.");
    }
    if (Object.values(allProfiles).some((p: UserProfile) => p.email === email)) {
      throw new Error("Este e-mail já está em uso.");
    }
    
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const newUserProfile: UserProfile = {
      username,
      displayName: username,
      email,
      registeredAt: new Date().toISOString(),
      isVerified: false,
      verificationCode,
    };
    
    const allPasswords = storageService.getAllPasswords();
    
    // In a real app, hash the password. Here we store it in plain text for simplicity.
    allPasswords[username] = password;
    allProfiles[username] = newUserProfile;
    
    storageService.saveAllProfiles(allProfiles);
    storageService.saveAllPasswords(allPasswords);
    
    return verificationCode;
  };
  
  const handleLogin = async (username: string, password: string) => {
    const allProfiles = storageService.getAllProfiles();
    const allPasswords = storageService.getAllPasswords();
    const profile = allProfiles[username];
    
    if (!profile || allPasswords[username] !== password) {
      throw new Error("Usuário ou senha inválidos.");
    }
    
    if (!profile.isVerified) {
        throw new Error("Sua conta não foi verificada. Por favor, verifique seu e-mail.");
    }

    let data = storageService.getUserData(username);
    if (!data) {
      data = { ...DEFAULT_USER_DATA, categories: [...INITIAL_CATEGORIES] }; // ensure fresh copy
      storageService.saveUserData(username, data);
    }
    
    setCurrentUser(profile);
    setUserData(data);
    sessionStorage.setItem('controlFin_currentUser', username);
    document.documentElement.setAttribute('data-theme', data.theme);
  };
  
  const handleVerifyEmail = async (username: string, code: string) => {
    const allProfiles = storageService.getAllProfiles();
    const profile = allProfiles[username];
    
    if (profile && profile.verificationCode === code) {
        profile.isVerified = true;
        delete profile.verificationCode;
        storageService.saveAllProfiles(allProfiles);
        
        // Auto-login after verification
        const allPasswords = storageService.getAllPasswords();
        await handleLogin(username, allPasswords[username]);
    } else {
        throw new Error("Código de verificação inválido.");
    }
  };
  
  const handleForgotPassword = async (email: string): Promise<string | null> => {
    const allProfiles = storageService.getAllProfiles();
    const profile = Object.values(allProfiles).find((p: UserProfile) => p.email === email);
    
    if (profile) {
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      profile.verificationCode = resetCode; // Reuse verification code for password reset
      storageService.saveAllProfiles(allProfiles);
      return resetCode;
    }
    return null;
  };
  
  const handleResetPassword = async (email: string, code: string, newPassword: string) => {
    const allProfiles = storageService.getAllProfiles();
    const profile = Object.values(allProfiles).find((p: UserProfile) => p.email === email);

    if (profile && profile.verificationCode === code) {
        const allPasswords = storageService.getAllPasswords();
        allPasswords[profile.username] = newPassword;
        delete profile.verificationCode;
        
        storageService.saveAllProfiles(allProfiles);
        storageService.saveAllPasswords(allPasswords);
    } else {
        throw new Error("Código de recuperação inválido.");
    }
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('controlFin_currentUser');
  };
  
  // --- ADMIN LOGIC ---
  const handleDeleteUser = (username: string) => {
    const allProfiles = storageService.getAllProfiles();
    const allPasswords = storageService.getAllPasswords();
    
    delete allProfiles[username];
    delete allPasswords[username];
    
    storageService.saveAllProfiles(allProfiles);
    storageService.saveAllPasswords(allPasswords);
    storageService.removeUserData(username);
    
    // Force a re-render of the admin panel
    setCurrentPage('Admin Panel'); 
    setTimeout(() => setCurrentPage('Admin Panel'), 0);
  };
  
  const handleResetUserData = (username: string) => {
    storageService.saveUserData(username, { ...DEFAULT_USER_DATA, categories: [...INITIAL_CATEGORIES] });
    alert(`Dados do usuário @${username} foram resetados.`);
  }

  // --- DATA SYNC ---
  useEffect(() => {
    if (currentUser) {
      storageService.saveUserData(currentUser.username, userData);
      document.documentElement.setAttribute('data-theme', userData.theme);
    }
  }, [userData, currentUser]);
  
  // --- TRANSACTIONS LOGIC ---
  const handleSaveTransaction = (transactionData: Omit<Transaction, 'id' | 'subItems'>) => {
    setUserData(prev => {
      let newTransactions = [...prev.transactions];

      if (editingTransaction) { // --- UPDATE ---
        newTransactions = newTransactions.map(t => {
            if (t.id === editingTransaction.id) {
                return { ...t, ...transactionData };
            }
            // Update parent if a subitem is edited
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
      
      // Recalculate parent amount if needed
      newTransactions = newTransactions.map(t => {
          if (t.subItems && t.subItems.length > 0) {
              const newAmount = t.subItems.reduce((sum, item) => sum + item.amount, 0);
              return { ...t, amount: newAmount };
          }
          return t;
      });
      
      // Sort transactions by date (most recent first)
      newTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
      setUserData(prev => {
        let newTransactions = [...prev.transactions];

        // Find and remove the transaction or sub-transaction
        newTransactions = newTransactions.filter(t => t.id !== transactionToDelete);
        
        // Also check within sub-items
        newTransactions = newTransactions.map(t => {
          if (t.subItems) {
            const filteredSubItems = t.subItems.filter(st => st.id !== transactionToDelete);
            // If subitems changed, recalculate parent amount
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
    setUserData(prev => {
        const newCategories = [...prev.categories];
        if (id) { // Update
            const index = newCategories.findIndex(c => c.id === id);
            if (index !== -1) {
                newCategories[index] = { ...newCategories[index], ...categoryData };
            }
        } else { // Create
            newCategories.push({ ...categoryData, id: `cat_${Date.now()}` });
        }
        return { ...prev, categories: newCategories };
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
      setUserData(prev => {
          // Prevent deleting a category if it's in use
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
      setUserData(prev => ({...prev, ...newSettings}));
  };
  
  const handleUpdateProfile = (newProfile: Partial<UserProfile>) => {
      if (!currentUser) return;
      const allProfiles = storageService.getAllProfiles();
      const updatedProfile = { ...allProfiles[currentUser.username], ...newProfile };
      allProfiles[currentUser.username] = updatedProfile;
      storageService.saveAllProfiles(allProfiles);
      setCurrentUser(updatedProfile);
  };
  
  // --- FINASSIST LOGIC ---
  const handleFinAssistSend = async (message: string) => {
    const newMessage: ChatMessage = { sender: 'user', text: message };
    setUserData(prev => ({ ...prev, chatHistory: [...prev.chatHistory, newMessage]}));
    setFinAssistThinking(true);
    
    try {
        const responseText = await getFinAssistResponse(message, userData.chatHistory, userData.transactions);
        const assistMessage: ChatMessage = { sender: 'finassist', text: responseText };
        setUserData(prev => ({ ...prev, chatHistory: [...prev.chatHistory, assistMessage]}));
    } catch (error) {
        console.error("FinAssist Error:", error);
        const errorMessage: ChatMessage = { sender: 'finassist', text: "Desculpe, não consegui processar sua solicitação no momento." };
        setUserData(prev => ({ ...prev, chatHistory: [...prev.chatHistory, errorMessage]}));
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
      return new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('pt-BR', {
          month: 'long',
          year: 'numeric',
      });
  };

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth) && selectedMonth !== 'all') {
      setSelectedMonth('all');
    }
  }, [availableMonths, selectedMonth]);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    // @ts-ignore
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

    if (isIOS && !isInStandaloneMode) {
        const lastPromptTime = localStorage.getItem('iosInstallPromptDismissed');
        const oneDay = 24 * 60 * 60 * 1000;
        if (!lastPromptTime || (new Date().getTime() - Number(lastPromptTime)) > oneDay) {
            setShowIOSInstallPrompt(true);
        }
    }
  }, []);


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
      case 'Admin Panel':
        if (currentUser?.username === 'admin') {
            return <AdminPanel onDeleteUser={handleDeleteUser} onResetUser={handleResetUserData} />;
        }
        return <p>Acesso negado.</p>;
      default:
        return <div>Página não encontrada</div>;
    }
  };
  
  if (!currentUser) {
    return <LoginScreen 
             onLogin={handleLogin} 
             onRegister={handleRegister}
             onVerifyEmail={handleVerifyEmail}
             onForgotPassword={handleForgotPassword}
             onResetPassword={handleResetPassword}
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
      {isSidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-40 md:hidden"></div>}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Header pageTitle={currentPage} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1">
          {renderPage()}
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

      {showIOSInstallPrompt && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-slate-700/90 backdrop-blur-lg text-white p-3 rounded-xl shadow-2xl z-50 flex items-center gap-4 animate-slide-up">
            <img src="logo.svg" alt="ControlFin Logo" className="w-12 h-12 rounded-lg"/>
            <div className="flex-grow">
                <p className="font-semibold">Instale o ControlFin!</p>
                <p className="text-xs text-slate-300">
                    Toque em <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mx-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414l-3-3z" clipRule="evenodd" transform="rotate(180 10 10)" /></svg> 
                    e depois em "Adicionar à Tela de Início".
                </p>
            </div>
            <button 
              onClick={() => {
                setShowIOSInstallPrompt(false);
                localStorage.setItem('iosInstallPromptDismissed', new Date().getTime().toString());
              }} 
              className="p-1 text-slate-400 hover:text-white"
            >
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
      )}
    </div>
  );
};

export default App;