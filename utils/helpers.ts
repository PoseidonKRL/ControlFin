import { Transaction, TransactionType } from '../types';

export const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
    currencyDisplay: 'symbol',
  }).format(amount);
};

export const processChartData = (transactions: Transaction[]) => {
  const monthlyData: { [key: string]: { income: number; expense: number } } = {};
  const categoryData: { [key: string]: number } = {};

  transactions.forEach(t => {
    if (t.parentId) return; // Only process parent transactions for summaries

    const month = new Date(t.date).toISOString().slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = { income: 0, expense: 0 };
    }
    if (t.type === TransactionType.INCOME) {
      monthlyData[month].income += t.amount;
    } else {
      monthlyData[month].expense += t.amount;
    }

    if (t.type === TransactionType.EXPENSE) {
      if (!categoryData[t.category]) {
        categoryData[t.category] = 0;
      }
      categoryData[t.category] += t.amount;
    }
  });

  const sortedMonths = Object.keys(monthlyData).sort();

  const incomeVsExpenseData = sortedMonths.map(month => ({
    name: new Date(month + '-02').toLocaleString('default', { month: 'short', year: '2-digit' }),
    Receita: monthlyData[month].income,
    Despesa: monthlyData[month].expense,
  }));

  const monthlyBalanceData = sortedMonths.map(month => ({
    name: new Date(month + '-02').toLocaleString('default', { month: 'short', year: '2-digit' }),
    Saldo: monthlyData[month].income - monthlyData[month].expense,
  }));

  const expenseByCategoryData = Object.entries(categoryData).map(([name, value]) => ({
    name,
    value,
  }));

  return { incomeVsExpenseData, monthlyBalanceData, expenseByCategoryData };
};

export const exportToCSV = (transactions: Transaction[], currency: string) => {
  const headers = ['ID', 'Data', 'Descrição', 'Categoria', 'Tipo', `Valor (${currency})`, 'ID Pai'];
  const csvRows = [headers.join(',')];

  const flattenedTransactions: Omit<Transaction, 'subItems'>[] = [];
  transactions.forEach(t => {
      // FIX: Use destructuring to remove 'subItems' property to match the Omit type.
      const { subItems, ...transactionWithoutSubItems } = t;
      flattenedTransactions.push(transactionWithoutSubItems);
      if (subItems) {
          subItems.forEach(st => {
              // FIX: Use destructuring to remove 'subItems' property to match the Omit type.
              const { subItems: _subItems, ...subTransaction } = st;
              flattenedTransactions.push(subTransaction);
          });
      }
  });

  for (const transaction of flattenedTransactions) {
    const values = [
      transaction.id,
      new Date(transaction.date).toLocaleDateString('pt-BR'),
      `"${transaction.description.replace(/"/g, '""')}"`,
      transaction.category,
      transaction.type,
      transaction.amount,
      transaction.parentId || '',
    ];
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', `controlfin_transacoes_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};