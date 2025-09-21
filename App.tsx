
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, Sector } from 'recharts';
import { UserData, Page, Transaction, TransactionType, Category, ChatMessage, UserProfile } from './types';
import { formatCurrency, processChartData, exportToCSV } from './utils/helpers';
import { getFinAssistResponse } from './services/geminiService';
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
                {hasSubItems && isExpanded && t.subItems!.map(sub => renderTransactionRow(sub, true))}
            </React.Fragment>
        );
    };

    const renderTransactionCard = (t: Transaction, isSubItem: boolean = false) => {
        const category = categories.find(c => c.name === t.category);
        const hasSubItems = t.subItems && t.subItems.length > 0;
        const isExpanded = expanded[t.id];

        return (
            <React.Fragment key={t.id}>
                <div className={`p-4 rounded-lg ${!isSubItem ? 'bg-[var(--color-bg-secondary)]' : 'bg-[var(--color-bg-secondary)]/50 ml-4'}`}>
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-3 flex-grow min-w-0">
                            <span className="p-2 bg-[var(--color-border)] rounded-lg flex-shrink-0">
                                <Icon name={category?.icon} className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-[var(--color-text-primary)] truncate">{t.description}</p>
                                    {isSubItem && t.notes && (
                                        <button 
                                            onClick={() => onShowNote(t.notes!)} 
                                            title="Ver anotação" 
                                            className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors flex-shrink-0"
                                            aria-label="Ver anotação"
                                        >
                                            <Icon name="document_text" className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-[var(--color-text-secondary)]">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>
                        <p className={`font-semibold text-right flex-shrink-0 ${t.type === TransactionType.INCOME ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                            {t.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(t.amount, currency)}
                        </p>
                    </div>
                    
                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-[var(--color-border)]/50">
                        {hasSubItems && (
                            <button onClick={() => toggleExpand(t.id)} className="p-1 rounded-full hover:bg-[var(--color-border)] mr-auto flex items-center gap-1 text-[var(--color-text-secondary)] text-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                {isExpanded ? 'Ocultar' : 'Mostrar'} subitens ({t.subItems!.length})
                            </button>
                        )}
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
                </div>
                {hasSubItems && isExpanded && (
                    <div className="space-y-2 mt-2">
                        {t.subItems!.map(sub => renderTransactionCard(sub, true))}
                    </div>
                )}
            </React.Fragment>
        );
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Transações</h1>
                <div className="flex flex-col sm:flex-row items-center gap-4">
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
                    <Button onClick={() => onAddTransaction()}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Adicionar Transação
                    </Button>
                </div>
            </div>

            <Card>
                 {/* Mobile View: Cards */}
                <div className="space-y-4 md:hidden">
                    {filteredTransactions.length > 0 ? (
                        filteredTransactions.map(t => renderTransactionCard(t))
                    ) : (
                        <p className="text-center py-10 text-[var(--color-text-secondary)]">
                            Nenhuma transação encontrada para este período.
                        </p>
                    )}
                </div>

                {/* Desktop View: Table */}
                <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-[var(--color-border)]">
                                <th className="py-3 px-4 font-semibold text-[var(--color-text-secondary)]">Descrição</th>
                                <th className="py-3 px-4 font-semibold text-[var(--color-text-secondary)]">Data</th>
                                <th className="py-3 px-4 font-semibold text-[var(--color-text-secondary)] text-right">Valor</th>
                                <th className="py-3 px-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.length > 0 ? (
                                filteredTransactions.map(t => renderTransactionRow(t))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-10 text-[var(--color-text-secondary)]">
                                        Nenhuma transação encontrada para este período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

// --- REPORTS PAGE ---
const ReportsPage: React.FC<{
    userData: UserData;
    selectedMonth: string;
    onMonthChange: (month: string) => void;
    availableMonths: string[];
    formatMonthYear: (month: string) => string;
}> = ({ userData, selectedMonth, onMonthChange, availableMonths, formatMonthYear }) => {
    const { categories, theme, currency } = userData;

    const filteredTransactions = useMemo(() => {
        if (selectedMonth === 'all') {
            return userData.transactions;
        }
        return userData.transactions.filter(t => t.date.startsWith(selectedMonth));
    }, [userData.transactions, selectedMonth]);

    const { monthlyBalanceData, expenseByCategoryData } = processChartData(filteredTransactions);
    
    // FIX: The 'activeIndex' prop on recharts' Pie component is causing a TypeScript error,
    // likely due to outdated type definitions. To work around this without suppressing the error,
    // we now manually handle rendering the active sector. onMouseEnter provides the necessary
    // props for the hovered slice, which we then use to render an enlarged <Sector /> component on top.
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const [activeSliceProps, setActiveSliceProps] = useState<any>(null);

    const onPieEnter = useCallback((data: any, index: number) => {
        setActiveIndex(index);
        setActiveSliceProps(data);
    }, []);

    const onPieLeave = useCallback(() => {
        setActiveIndex(-1);
        setActiveSliceProps(null);
    }, []);

    const PIE_COLORS = theme === 'galaxy'
        ? ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f', '#ffbb28']
        : ['#3b82f6', '#16a34a', '#f59e0b', '#ef4444', '#6366f1', '#10b981', '#f97316'];
    
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

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        const category = expenseByCategoryData[index];
        const categoryIcon = categories.find(c => c.name === category.name)?.icon;
        
        const percentage = (percent ?? 0) * 100;
        
        if (percentage < 5) return null;

        return (
            <g>
                <foreignObject x={x - 16} y={y - 16} width={32} height={32}>
                    <div className="bg-[var(--color-bg-primary)]/50 p-1.5 rounded-full flex items-center justify-center">
                        <Icon name={categoryIcon} className="w-5 h-5 text-[var(--color-text-primary)]" />
                    </div>
                </foreignObject>
                 <text x={x} y={y + 28} fill="var(--color-text-primary)" textAnchor="middle" dominantBaseline="central" className="text-xs font-semibold">
                    {`${percentage.toFixed(0)}%`}
                </text>
            </g>
        );
    };

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Relatórios</h1>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Despesas por Categoria</h2>
                     <div className="h-80 md:h-96">
                        {expenseByCategoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        onMouseEnter={onPieEnter}
                                        onMouseLeave={onPieLeave}
                                        data={expenseByCategoryData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={renderCustomizedLabel}
                                        outerRadius={120}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {expenseByCategoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={activeIndex === index ? 'transparent' : PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    {activeSliceProps && (
                                        <Sector
                                            {...activeSliceProps}
                                            outerRadius={activeSliceProps.outerRadius + 8}
                                        />
                                    )}
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: tooltipColors.background,
                                            borderColor: tooltipColors.border,
                                            backdropFilter: 'blur(4px)',
                                            borderRadius: '0.75rem',
                                        }}
                                        labelStyle={{ color: tooltipColors.label }}
                                        formatter={(value: number, name: string) => [formatCurrency(value, currency), name]}
                                    />
                                    <Legend wrapperStyle={{ color: tooltipColors.legend, paddingTop: '20px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
                                Nenhuma despesa encontrada para este período.
                            </div>
                        )}
                    </div>
                </Card>
                <Card>
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Saldo Mensal</h2>
                     <div className="h-80 md:h-96">
                        {monthlyBalanceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyBalanceData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
                                    <XAxis dataKey="name" stroke={chartColors.text} angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                                    <YAxis stroke={chartColors.text} tickFormatter={(value) => formatCurrency(value as number, currency)}/>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: tooltipColors.background,
                                            borderColor: tooltipColors.border,
                                            backdropFilter: 'blur(4px)',
                                            borderRadius: '0.75rem',
                                        }}
                                        labelStyle={{ color: tooltipColors.label }}
                                        formatter={(value: number) => formatCurrency(value, currency)}
                                    />
                                    <Legend wrapperStyle={{ color: tooltipColors.legend }} />
                                    <Bar dataKey="Saldo" radius={[4, 4, 0, 0]} animationDuration={800}>
                                        {monthlyBalanceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.Saldo >= 0 ? chartColors.barSuccess : chartColors.barDanger} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
                                Nenhum dado de saldo encontrado para este período.
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

// --- SETTINGS PAGE ---
const SettingsPage: React.FC<{
    userData: UserData;
    userProfile: UserProfile;
    onUpdateCategories: (categories: Category[]) => void;
    onUpdateCurrency: (currency: string) => void;
    onDeleteCategory: (categoryId: string) => void;
    onUpdateTheme: (theme: 'galaxy' | 'minimalist') => void;
    onUpdateProfile: (profile: Partial<UserProfile>) => void;
}> = ({ userData, userProfile, onUpdateCategories, onUpdateCurrency, onDeleteCategory, onUpdateTheme, onUpdateProfile }) => {
    const { categories, currency, theme } = userData;
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const [isIconPickerOpen, setIconPickerOpen] = useState(false);
    const [categoryForIconChange, setCategoryForIconChange] = useState<Category | null>(null);

    const [isEditingName, setIsEditingName] = useState(false);
    const [editingDisplayName, setEditingDisplayName] = useState(userProfile.displayName);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddCategory = () => {
        if (newCategoryName.trim() && !categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
            const newCategory: Category = {
                id: `cat${Date.now()}`,
                name: newCategoryName.trim(),
                icon: 'question_mark_circle', // Default icon
            };
            onUpdateCategories([...categories, newCategory]);
            setNewCategoryName('');
        }
    };

    const handleUpdateCategory = (categoryToUpdate: Category) => {
        if(categoryToUpdate.name.trim()){
            const updatedCategories = categories.map(c =>
                c.id === categoryToUpdate.id ? categoryToUpdate : c
            );
            onUpdateCategories(updatedCategories);
            setEditingCategory(null);
        }
    };

    const openIconPicker = (category: Category) => {
        setCategoryForIconChange(category);
        setIconPickerOpen(true);
    };

    const handleSelectIcon = (iconName: string) => {
        if (categoryForIconChange) {
            const updatedCategories = categories.map(c =>
                c.id === categoryForIconChange.id ? { ...c, icon: iconName } : c
            );
            onUpdateCategories(updatedCategories);
        }
        setIconPickerOpen(false);
        setCategoryForIconChange(null);
    };

    const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result as string;
            onUpdateProfile({ profilePicture: base64String });
        };
        reader.readAsDataURL(file);
    };

    const handleSaveDisplayName = () => {
        if (editingDisplayName.trim()) {
            onUpdateProfile({ displayName: editingDisplayName.trim() });
            setIsEditingName(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Configurações</h1>
            
            <Card>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Perfil</h2>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative">
                        <input type="file" ref={fileInputRef} onChange={handleProfilePictureChange} accept="image/*" className="hidden" />
                        {userProfile.profilePicture ? (
                            <img src={userProfile.profilePicture} alt="Foto de perfil" className="w-24 h-24 rounded-full object-cover" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center font-bold text-slate-900 text-5xl">
                                {userProfile.displayName.charAt(0)}
                            </div>
                        )}
                        <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] transition-colors" title="Trocar foto">
                            <Icon name="photo" className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex-grow text-center sm:text-left">
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <Input value={editingDisplayName} onChange={(e) => setEditingDisplayName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveDisplayName()}/>
                                <Button onClick={handleSaveDisplayName} className="p-2"><Icon name="check" className="h-5 w-5"/></Button>
                                <Button variant="secondary" onClick={() => { setIsEditingName(false); setEditingDisplayName(userProfile.displayName); }} className="p-2"><Icon name="x_mark" className="h-5 w-5"/></Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 justify-center sm:justify-start">
                                <h3 className="text-2xl font-bold">{userProfile.displayName}</h3>
                                <Button variant="secondary" className="p-2" onClick={() => setIsEditingName(true)} title="Editar nome">
                                    <Icon name="pencil" className="h-5 w-5" />
                                </Button>
                            </div>
                        )}
                        <p className="text-[var(--color-text-secondary)]">@{userProfile.username} &middot; {userProfile.email}</p>
                    </div>
                </div>
            </Card>

             <Card>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Tema do Aplicativo</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Galaxy Theme */}
                    <div onClick={() => onUpdateTheme('galaxy')} className={`cursor-pointer rounded-lg p-4 border-2 ${theme === 'galaxy' ? 'border-[var(--color-accent)]' : 'border-transparent'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-lg">Galaxy</h3>
                             {theme === 'galaxy' && <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>}
                        </div>
                        <div className="h-24 rounded-md bg-[#0f172a] border border-[#334155] p-3 flex flex-col justify-between">
                             <div className="flex justify-between">
                                <span className="text-xs text-[#94a3b8]">Escuro & Vibrante</span>
                                <div className="w-6 h-4 rounded bg-[#9333ea]"></div>
                             </div>
                             <div className="w-full h-8 rounded bg-[#1e293b] border border-[#334155] flex items-center p-1.5">
                                <div className="w-1/2 h-full rounded-sm bg-[#4ade80]"></div>
                                <div className="w-1/2 h-full rounded-sm bg-[#f87171]"></div>
                             </div>
                        </div>
                    </div>
                     {/* Minimalist Theme */}
                    <div onClick={() => onUpdateTheme('minimalist')} className={`cursor-pointer rounded-lg p-4 border-2 ${theme === 'minimalist' ? 'border-[var(--color-accent)]' : 'border-transparent'}`}>
                         <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-lg">Minimalista</h3>
                            {theme === 'minimalist' && <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>}
                        </div>
                        <div className="h-24 rounded-md bg-[#f9fafb] border border-[#e5e7eb] p-3 flex flex-col justify-between">
                             <div className="flex justify-between">
                                <span className="text-xs text-[#6b7280]">Claro & Limpo</span>
                                <div className="w-6 h-4 rounded bg-[#2563eb]"></div>
                             </div>
                             <div className="w-full h-8 rounded bg-[#ffffff] border border-[#e5e7eb] flex items-center p-1.5">
                                <div className="w-1/2 h-full rounded-sm bg-[#16a34a]"></div>
                                <div className="w-1/2 h-full rounded-sm bg-[#ef4444]"></div>
                             </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Gerenciar Categorias</h2>
                <div className="space-y-3">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-[var(--color-bg-secondary)] p-3 rounded-lg">
                           {editingCategory?.id === cat.id ? (
                                <div className="flex flex-wrap items-center gap-2 flex-grow w-full">
                                    <button onClick={() => openIconPicker(cat)} className="p-2 rounded-md bg-[var(--color-border)] hover:bg-[var(--color-accent)] transition-colors">
                                        <Icon name={cat.icon} className="h-6 w-6" />
                                    </button>
                                    <Input
                                        type="text"
                                        value={editingCategory.name}
                                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                        className="flex-grow min-w-[120px]"
                                        autoFocus
                                    />
                                     <div className='flex gap-2 ml-auto'>
                                        <Button onClick={() => handleUpdateCategory(editingCategory)}>Salvar</Button>
                                        <Button variant="secondary" onClick={() => setEditingCategory(null)}>Cancelar</Button>
                                     </div>
                                </div>
                           ) : (
                            <>
                                <div className="flex items-center gap-3">
                                     <button onClick={() => openIconPicker(cat)} className="p-2 rounded-md bg-[var(--color-border)] hover:bg-[var(--color-accent)] transition-colors">
                                        <Icon name={cat.icon} className="h-6 w-6" />
                                     </button>
                                    <span className="text-[var(--color-text-primary)]">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button variant="secondary" className="p-2" onClick={() => setEditingCategory(cat)} title="Editar">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                    </Button>
                                    <Button variant="danger" className="p-2" onClick={() => onDeleteCategory(cat.id)} title="Excluir">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </Button>
                                </div>
                            </>
                           )}
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                    <Input
                        type="text"
                        placeholder="Nova categoria..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-grow"
                    />
                    <Button onClick={handleAddCategory}>Adicionar</Button>
                </div>
            </Card>

            <Card>
                 <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Configurações Gerais</h2>
                 <div className="max-w-xs">
                    <Select label="Moeda" value={currency} onChange={e => onUpdateCurrency(e.target.value)}>
                        <option value="BRL">Real Brasileiro (BRL)</option>
                        <option value="USD">Dólar Americano (USD)</option>
                        <option value="EUR">Euro (EUR)</option>
                    </Select>
                 </div>
                 <div className="mt-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Exportar Dados</h3>
                    <Button variant="secondary" onClick={() => exportToCSV(userData.transactions, currency)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                       Exportar para CSV
                    </Button>
                </div>
            </Card>
            
            <IconPickerModal
                isOpen={isIconPickerOpen}
                onClose={() => setIconPickerOpen(false)}
                onSelectIcon={handleSelectIcon}
            />

        </div>
    );
};

// --- ADMIN PAGE ---
const AdminPage: React.FC<{
    userProfiles: { [username: string]: UserProfile };
    onDeleteUser: (username: string) => void;
}> = ({ userProfiles, onDeleteUser }) => {
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    const handleDeleteRequest = (username: string) => {
        setUserToDelete(username);
    };

    const confirmDelete = () => {
        if (userToDelete) {
            onDeleteUser(userToDelete);
            setUserToDelete(null);
        }
    };
    
    const users = Object.values(userProfiles).filter(p => p.username !== 'admin');

    return (
        <div className="p-4 md:p-8 space-y-6">
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">Painel do Administrador</h1>

            <Card>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Gerenciar Usuários</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-[var(--color-border)]">
                                <th className="py-3 px-4 font-semibold text-[var(--color-text-secondary)]">Usuário</th>
                                <th className="py-3 px-4 font-semibold text-[var(--color-text-secondary)]">E-mail</th>
                                <th className="py-3 px-4 font-semibold text-[var(--color-text-secondary)]">Registrado em</th>
                                <th className="py-3 px-4 font-semibold text-[var(--color-text-secondary)]">Status</th>
                                <th className="py-3 px-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length > 0 ? (
                                users.map(user => (
                                    <tr key={user.username} className="border-b border-[var(--color-border)]">
                                        <td className="py-3 px-4">
                                            <div className="font-medium">@{user.username}</div>
                                            <div className="text-sm text-[var(--color-text-secondary)]">{user.displayName}</div>
                                        </td>
                                        <td className="py-3 px-4">{user.email}</td>
                                        <td className="py-3 px-4">{new Date(user.registeredAt).toLocaleDateString('pt-BR')}</td>
                                        <td className="py-3 px-4">
                                            {user.isVerified ? 
                                                <span className="px-2 py-1 text-xs font-semibold text-green-200 bg-green-800 rounded-full">Verificado</span> :
                                                <span className="px-2 py-1 text-xs font-semibold text-yellow-200 bg-yellow-800 rounded-full">Não Verificado</span>
                                            }
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <Button variant="danger" onClick={() => handleDeleteRequest(user.username)}>Excluir</Button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-[var(--color-text-secondary)]">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <ConfirmationModal
                isOpen={userToDelete !== null}
                onClose={() => setUserToDelete(null)}
                onConfirm={confirmDelete}
                title={`Excluir Usuário`}
                confirmText="Excluir Permanentemente"
                confirmVariant="danger"
            >
                <p>
                    Você tem certeza de que deseja excluir o usuário <strong>@{userToDelete}</strong>? 
                    Todos os seus dados financeiros serão permanentemente apagados. Esta ação não pode ser desfeita.
                </p>
            </ConfirmationModal>
        </div>
    );
};

// --- FINASSIST CHAT ---
const FinAssist: React.FC<{
    transactions: Transaction[];
    history: ChatMessage[];
    onNewMessage: (message: ChatMessage) => void;
}> = ({ transactions, history, onNewMessage }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleSend = async () => {
        if (!prompt.trim() || isLoading) return;

        const userMessage: ChatMessage = { sender: 'user', text: prompt };
        onNewMessage(userMessage);
        setPrompt('');
        setIsLoading(true);

        const responseText = await getFinAssistResponse(prompt, history, transactions);
        
        const botMessage: ChatMessage = { sender: 'finassist', text: responseText };
        onNewMessage(botMessage);
        setIsLoading(false);
    };

    return (
        <>
            <div className={`fixed bottom-6 right-6 z-40 transition-transform duration-300 ${isOpen ? 'scale-0' : 'scale-100'}`}>
                <button onClick={() => setIsOpen(true)} className="p-4 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 text-white shadow-2xl shadow-purple-500/40 transform hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </button>
            </div>
            
            <div className={`fixed bottom-0 right-0 md:bottom-6 md:right-6 z-50 w-full h-full md:w-[400px] md:h-auto md:max-h-[80vh] bg-[var(--color-bg-secondary)]/80 backdrop-blur-xl border-t md:border border-[var(--color-border)] rounded-t-2xl md:rounded-2xl shadow-2xl shadow-purple-500/20 flex flex-col transform transition-transform duration-500 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                <header className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">FinAssist</h3>
                    <button onClick={() => setIsOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                
                <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                    {history.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                            {msg.sender === 'finassist' && <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 flex-shrink-0"></div>}
                            <div className={`max-w-xs md:max-w-sm px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-[var(--color-accent)] text-white rounded-br-none' : 'bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-bl-none'}`}>
                                <p className="text-sm">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 flex-shrink-0"></div>
                            <div className="max-w-xs md:max-w-sm px-4 py-2 rounded-2xl bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-bl-none">
                                <div className="flex items-center gap-2">
                                   <Spinner /> 
                                   <span className="text-sm text-[var(--color-text-secondary)]">Analisando...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <footer className="p-4 border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-2">
                        <Input
                            type="text"
                            placeholder="Pergunte ao FinAssist..."
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            className="flex-grow"
                            disabled={isLoading}
                        />
                        <Button onClick={handleSend} disabled={isLoading || !prompt.trim()}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </Button>
                    </div>
                </footer>
            </div>
        </>
    );
};

// --- DB KEYS ---
const PROFILES_DB_KEY = 'controlFin_profiles_db';
const PASSWORDS_DB_KEY = 'controlFin_passwords_db';
const USER_DATA_PREFIX = 'controlFinData_';

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [userProfiles, setUserProfiles] = useState<{ [key: string]: UserProfile }>({});
    const [userPasswords, setUserPasswords] = useState<{ [key: string]: string }>({});
    const [userData, setUserData] = useState<UserData>(DEFAULT_USER_DATA);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    
    const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState('all');

    const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [subItemParentId, setSubItemParentId] = useState<string | undefined>(undefined);
    
    const [isDeleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'transaction' | 'category', id: string } | null>(null);
    const [noteToShow, setNoteToShow] = useState<string | null>(null);


    // PWA Service Worker Registration
    useEffect(() => {
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
              .then(registration => console.log('Service Worker registered with scope: ', registration.scope))
              .catch(err => console.log('Service Worker registration failed: ', err));
          });
        }
      }, []);

    // Load all user profiles and passwords from localStorage on initial render
    useEffect(() => {
        const savedProfiles = JSON.parse(localStorage.getItem(PROFILES_DB_KEY) || '{}');
        const savedPasswords = JSON.parse(localStorage.getItem(PASSWORDS_DB_KEY) || '{}');

        // Ensure admin user exists
        if (!savedProfiles['admin']) {
            savedProfiles['admin'] = { 
                username: 'admin', 
                displayName: 'Admin',
                email: 'admin@controlfin.app',
                isVerified: true,
                registeredAt: new Date().toISOString() 
            };
            savedPasswords['admin'] = 'admin'; // In a real app, this would be hashed
            localStorage.setItem(PROFILES_DB_KEY, JSON.stringify(savedProfiles));
            localStorage.setItem(PASSWORDS_DB_KEY, JSON.stringify(savedPasswords));
        }

        setUserProfiles(savedProfiles);
        setUserPasswords(savedPasswords);
        setIsDataLoaded(true);
    }, []);
    
    // Load specific user financial data when currentUser changes
    useEffect(() => {
        if (currentUser) {
            const savedData = localStorage.getItem(`${USER_DATA_PREFIX}${currentUser.username}`);
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                const categoriesWithIcons = parsedData.categories.map((c: Category) => ({
                    ...c,
                    icon: c.icon ?? INITIAL_CATEGORIES.find(ic => ic.name === c.name)?.icon ?? 'question_mark_circle'
                }));
                const mergedCategories = [...categoriesWithIcons];
                INITIAL_CATEGORIES.forEach(initialCat => {
                    if (!mergedCategories.some(userCat => userCat.name === initialCat.name)) {
                        mergedCategories.push(initialCat);
                    }
                });
                const theme = parsedData.theme || 'galaxy';
                setUserData({ ...DEFAULT_USER_DATA, ...parsedData, categories: mergedCategories, theme });
            } else {
                setUserData(DEFAULT_USER_DATA);
            }
        }
    }, [currentUser]);

    // Save user's financial data to localStorage when it changes
    useEffect(() => {
        if (currentUser) {
            localStorage.setItem(`${USER_DATA_PREFIX}${currentUser.username}`, JSON.stringify(userData));
        }
    }, [userData, currentUser]);

    // Set theme on body
    useEffect(() => {
        document.documentElement.dataset.theme = userData.theme;
    }, [userData.theme]);

    const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
    
    const handleLogin = async (username: string, password: string) => {
      const profile = userProfiles[username];
      if (!profile || userPasswords[username] !== password) {
        throw new Error("Usuário ou senha inválidos.");
      }
      if (!profile.isVerified) {
          throw new Error("Sua conta não foi verificada. Por favor, cadastre-se novamente para receber um novo código.");
      }
      setCurrentUser(profile);
    };

    const handleRegister = async (username: string, password: string, email: string): Promise<string> => {
        if (userProfiles[username]) {
            throw new Error("Este nome de usuário já existe.");
        }
        if (Object.values(userProfiles).some(p => p.email.toLowerCase() === email.toLowerCase())) {
            throw new Error("Este e-mail já está em uso.");
        }
        
        const verificationCode = generateCode();

        const newUserProfile: UserProfile = {
            username,
            displayName: username,
            email,
            registeredAt: new Date().toISOString(),
            isVerified: false, // Starts as unverified
            verificationCode,
        };

        const updatedProfiles = { ...userProfiles, [username]: newUserProfile };
        const updatedPasswords = { ...userPasswords, [username]: password };
        
        setUserProfiles(updatedProfiles);
        setUserPasswords(updatedPasswords);

        localStorage.setItem(PROFILES_DB_KEY, JSON.stringify(updatedProfiles));
        localStorage.setItem(PASSWORDS_DB_KEY, JSON.stringify(updatedPasswords));
        localStorage.setItem(`${USER_DATA_PREFIX}${username}`, JSON.stringify(DEFAULT_USER_DATA));
        
        return verificationCode;
    };

    const handleVerifyEmail = async (username: string, code: string) => {
        const profile = userProfiles[username];
        if (!profile || profile.verificationCode !== code) {
            throw new Error("Código de verificação inválido.");
        }
        
        const verifiedProfile: UserProfile = { ...profile, isVerified: true, verificationCode: undefined };
        const updatedProfiles = { ...userProfiles, [username]: verifiedProfile };
        setUserProfiles(updatedProfiles);
        localStorage.setItem(PROFILES_DB_KEY, JSON.stringify(updatedProfiles));
        
        setCurrentUser(verifiedProfile);
    };

    const handleForgotPassword = async (email: string): Promise<string | null> => {
        const userEntry = Object.entries(userProfiles).find(([_, profile]) => profile.email.toLowerCase() === email.toLowerCase());
        if (!userEntry) {
            throw new Error("Nenhum usuário encontrado com este e-mail.");
        }
        
        const username = userEntry[0];
        const resetCode = generateCode();

        const updatedProfile = { ...userEntry[1], verificationCode: resetCode };
        const updatedProfiles = { ...userProfiles, [username]: updatedProfile };
        
        setUserProfiles(updatedProfiles);
        localStorage.setItem(PROFILES_DB_KEY, JSON.stringify(updatedProfiles));

        return resetCode;
    };
    
    const handleResetPassword = async (email: string, code: string, newPassword: string) => {
        const userEntry = Object.entries(userProfiles).find(([_, profile]) => profile.email.toLowerCase() === email.toLowerCase());
        if (!userEntry) throw new Error("Usuário não encontrado.");

        const username = userEntry[0];
        const profile = userEntry[1];
        
        if (profile.verificationCode !== code) {
            throw new Error("Código de recuperação inválido.");
        }

        const updatedProfile = { ...profile, verificationCode: undefined };
        const updatedProfiles = { ...userProfiles, [username]: updatedProfile };
        const updatedPasswords = { ...userPasswords, [username]: newPassword };

        setUserProfiles(updatedProfiles);
        setUserPasswords(updatedPasswords);
        localStorage.setItem(PROFILES_DB_KEY, JSON.stringify(updatedProfiles));
        localStorage.setItem(PASSWORDS_DB_KEY, JSON.stringify(updatedPasswords));
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setCurrentPage('Dashboard');
        setSelectedMonth('all');
    };

    const handleNavigate = (page: Page) => {
        setCurrentPage(page);
        setSidebarOpen(false);
    };

    // --- Transaction Handlers ---
    const handleSaveTransaction = (transactionData: Omit<Transaction, 'id' | 'subItems'>) => {
        setUserData(prev => {
            let updatedTransactions: Transaction[];
            const parentIdToUpdate = transactionData.parentId;
    
            if (editingTransaction) { // --- UPDATE ---
                updatedTransactions = prev.transactions.map(t =>
                    t.id === editingTransaction.id ? { ...t, ...transactionData } : t
                );
            } else { // --- ADD NEW ---
                const newTransaction: Transaction = {
                    ...transactionData,
                    id: `trans${Date.now()}`,
                };
                updatedTransactions = [...prev.transactions, newTransaction];
            }
    
            if (parentIdToUpdate) {
                const newParentAmount = updatedTransactions
                    .filter(t => t.parentId === parentIdToUpdate)
                    .reduce((sum, item) => sum + item.amount, 0);
    
                updatedTransactions = updatedTransactions.map(t =>
                    t.id === parentIdToUpdate ? { ...t, amount: newParentAmount } : t
                );
            }
            
            return { ...prev, transactions: updatedTransactions };
        });
        setEditingTransaction(null);
        setSubItemParentId(undefined);
    };
    
    const openTransactionModal = (transaction?: Transaction, parentId?: string) => {
        setEditingTransaction(transaction || null);
        setSubItemParentId(parentId);
        setTransactionModalOpen(true);
    };

    const handleDeleteTransactionRequest = (transactionId: string) => {
        setItemToDelete({ type: 'transaction', id: transactionId });
        setDeleteConfirmModalOpen(true);
    };

    const confirmDeleteTransaction = (transactionId: string) => {
        const transactionToDelete = userData.transactions.find(t => t.id === transactionId);
        if (!transactionToDelete) return;
        const childIds = userData.transactions.filter(t => t.parentId === transactionId).map(t => t.id);
        const idsToDelete = new Set([transactionId, ...childIds]);
        let updatedTransactions = userData.transactions.filter(t => !idsToDelete.has(t.id));
    
        if (transactionToDelete.parentId) {
            const parentId = transactionToDelete.parentId;
            const newAmount = updatedTransactions
                .filter(sub => sub.parentId === parentId)
                .reduce((sum, item) => sum + item.amount, 0);
            updatedTransactions = updatedTransactions.map(t => 
                t.id === parentId ? { ...t, amount: newAmount } : t
            );
        }
        setUserData(prev => ({ ...prev, transactions: updatedTransactions }));
    };

    // --- Category Handlers ---
    const handleUpdateCategories = (categories: Category[]) => {
        setUserData(prev => ({...prev, categories}));
    };
    
    const handleDeleteCategoryRequest = (categoryId: string) => {
        const categoryToDelete = userData.categories.find(c => c.id === categoryId);
        if (!categoryToDelete) return;

        const isInUse = userData.transactions.some(t => t.category === categoryToDelete.name || t.subItems?.some(sub => sub.category === categoryToDelete.name));
        if (isInUse) {
            alert("Não é possível excluir a categoria, pois ela está sendo usada em transações.");
            return;
        }
        setItemToDelete({ type: 'category', id: categoryId });
        setDeleteConfirmModalOpen(true);
    };
    
    const confirmDeleteCategory = (categoryId: string) => {
        handleUpdateCategories(userData.categories.filter(c => c.id !== categoryId));
    };

    const confirmDelete = () => {
        if (!itemToDelete) return;
        if(itemToDelete.type === 'transaction') {
            confirmDeleteTransaction(itemToDelete.id);
        } else {
            confirmDeleteCategory(itemToDelete.id);
        }
        setDeleteConfirmModalOpen(false);
        setItemToDelete(null);
    };
    
    // --- Profile & Other Handlers ---
    const handleUpdateProfile = (profileUpdate: Partial<UserProfile>) => {
        if (!currentUser) return;

        const updatedProfile = { ...currentUser, ...profileUpdate };
        const updatedProfiles = { ...userProfiles, [currentUser.username]: updatedProfile };
        setUserProfiles(updatedProfiles);
        setCurrentUser(updatedProfile);
        localStorage.setItem(PROFILES_DB_KEY, JSON.stringify(updatedProfiles));
    };
    
    const handleDeleteUser = (usernameToDelete: string) => {
        const updatedProfiles = { ...userProfiles };
        delete updatedProfiles[usernameToDelete];

        const updatedPasswords = { ...userPasswords };
        delete updatedPasswords[usernameToDelete];

        setUserProfiles(updatedProfiles);
        setUserPasswords(updatedPasswords);
        
        localStorage.setItem(PROFILES_DB_KEY, JSON.stringify(updatedProfiles));
        localStorage.setItem(PASSWORDS_DB_KEY, JSON.stringify(updatedPasswords));
        localStorage.removeItem(`${USER_DATA_PREFIX}${usernameToDelete}`);
    };

    const handleUpdateCurrency = (currency: string) => setUserData(prev => ({ ...prev, currency }));
    const handleUpdateTheme = (theme: 'galaxy' | 'minimalist') => setUserData(prev => ({ ...prev, theme }));
    const handleNewChatMessage = (message: ChatMessage) => setUserData(prev => ({ ...prev, chatHistory: [...prev.chatHistory, message]}));

    const transactionsWithSubItems = useMemo(() => {
        const allTransactions = [...userData.transactions];
        const transactionMap: { [id: string]: Transaction } = {};
        const rootTransactions: Transaction[] = [];
        allTransactions.forEach(t => { transactionMap[t.id] = { ...t, subItems: [] }; });
        allTransactions.forEach(t => {
            if (t.parentId && transactionMap[t.parentId]) {
                transactionMap[t.parentId].subItems!.push(transactionMap[t.id]);
            } else {
                rootTransactions.push(transactionMap[t.id]);
            }
        });
        const sortByDate = (a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime();
        rootTransactions.sort(sortByDate);
        rootTransactions.forEach(t => { if (t.subItems) { t.subItems.sort(sortByDate); } });
        return rootTransactions;
    }, [userData.transactions]);
    
    const formatMonthYear = useCallback((monthStr: string) => {
        const [year, month] = monthStr.split('-');
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('pt-BR', {
            month: 'long',
            year: 'numeric'
        }).replace(/^\w/, c => c.toUpperCase());
    }, []);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        userData.transactions.forEach(t => {
            months.add(t.date.slice(0, 7)); // 'YYYY-MM'
        });
        return Array.from(months).sort().reverse();
    }, [userData.transactions]);


    if (!isDataLoaded) {
        return <div className="w-screen h-screen bg-slate-900 flex items-center justify-center"><Spinner /></div>
    }

    if (!currentUser) {
        return <LoginScreen 
            onLogin={handleLogin} 
            onRegister={handleRegister} 
            onVerifyEmail={handleVerifyEmail}
            onForgotPassword={handleForgotPassword}
            onResetPassword={handleResetPassword}
        />;
    }

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
                            transactions={transactionsWithSubItems}
                            categories={userData.categories}
                            currency={userData.currency}
                            onAddTransaction={(parentId) => openTransactionModal(undefined, parentId)}
                            onEditTransaction={(t) => openTransactionModal(t)}
                            onDeleteTransaction={handleDeleteTransactionRequest}
                            onShowNote={(note) => setNoteToShow(note)}
                            selectedMonth={selectedMonth}
                            onMonthChange={setSelectedMonth}
                            availableMonths={availableMonths}
                            formatMonthYear={formatMonthYear}
                         />;
            case 'Reports':
                return <ReportsPage
                            userData={userData} 
                            selectedMonth={selectedMonth}
                            onMonthChange={setSelectedMonth}
                            availableMonths={availableMonths}
                            formatMonthYear={formatMonthYear}
                        />;
            case 'Settings':
                return <SettingsPage 
                    userData={userData}
                    userProfile={currentUser}
                    onUpdateCategories={handleUpdateCategories}
                    onUpdateCurrency={handleUpdateCurrency}
                    onDeleteCategory={handleDeleteCategoryRequest}
                    onUpdateTheme={handleUpdateTheme}
                    onUpdateProfile={handleUpdateProfile}
                />;
            case 'Admin Panel':
                return currentUser.username === 'admin' ? 
                       <AdminPage userProfiles={userProfiles} onDeleteUser={handleDeleteUser} /> 
                       : <Dashboard userData={userData} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} availableMonths={availableMonths} formatMonthYear={formatMonthYear}/>; // fallback
            default:
                return <Dashboard userData={userData} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} availableMonths={availableMonths} formatMonthYear={formatMonthYear}/>;
        }
    };
    
    return (
        <div className="flex h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
            <Sidebar 
                currentPage={currentPage}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                userProfile={currentUser}
                isOpen={isSidebarOpen}
            />
            {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)}></div>}
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header pageTitle={currentPage} onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-y-auto">
                    {renderPage()}
                </main>
            </div>

            <FinAssist 
                transactions={userData.transactions}
                history={userData.chatHistory}
                onNewMessage={handleNewChatMessage}
            />
            
            <TransactionModal
                isOpen={isTransactionModalOpen}
                onClose={() => { setTransactionModalOpen(false); setEditingTransaction(null); setSubItemParentId(undefined); }}
                onSave={handleSaveTransaction}
                categories={userData.categories}
                currency={userData.currency}
                editingTransaction={editingTransaction}
                parentId={subItemParentId}
            />

            <ConfirmationModal
                isOpen={isDeleteConfirmModalOpen}
                onClose={() => setDeleteConfirmModalOpen(false)}
                onConfirm={confirmDelete}
                title={`Excluir ${itemToDelete?.type === 'transaction' ? 'Transação' : 'Categoria'}`}
                confirmText="Excluir"
                confirmVariant="danger"
            >
                <p>
                    Você tem certeza de que deseja excluir est{itemToDelete?.type === 'transaction' ? 'a transação' : 'a categoria'}? 
                    Esta ação não pode ser desfeita.
                </p>
            </ConfirmationModal>

            <Modal
                isOpen={noteToShow !== null}
                onClose={() => setNoteToShow(null)}
                title="Anotação do Subitem"
            >
                <div className="text-[var(--color-text-secondary)] whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">
                    {noteToShow}
                </div>
                <div className="flex justify-end pt-6">
                    <Button variant="secondary" onClick={() => setNoteToShow(null)}>
                        Fechar
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default App;