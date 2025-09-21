import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Transaction, TransactionType } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("Gemini API key not found. Please set the API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const getFinancialSummary = (transactions: Transaction[]): string => {
  const totalIncome = transactions
    .filter(t => t.type === TransactionType.INCOME && !t.parentId)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE && !t.parentId)
    .reduce((sum, t) => sum + t.amount, 0);

  return `Aqui está um resumo da situação financeira atual do usuário:
- Receita Total: ${totalIncome.toFixed(2)}
- Despesas Totais: ${totalExpense.toFixed(2)}
- Saldo Líquido: ${(totalIncome - totalExpense).toFixed(2)}`;
};

export const getFinAssistResponse = async (
  prompt: string,
  history: ChatMessage[],
  transactions: Transaction[]
): Promise<string> => {
  if (!API_KEY) {
    return "Chave da API não configurada. Por favor, configure-a em seu ambiente.";
  }

  try {
    const financialContext = getFinancialSummary(transactions);

    const fullPrompt = `
      ${financialContext}
      
      Pergunta do usuário: "${prompt}"
    `;

    // History format conversion for the API is not directly supported in this simple chat.
    // We will send the full context each time for simplicity.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          systemInstruction: "Você é o 'FinAssist', um assistente financeiro amigável, conciso e prestativo. Analise o resumo financeiro fornecido e a pergunta do usuário para dar conselhos perspicazes. Suas respostas devem ser claras, em português, e práticas.",
        }
    });

    return response.text;
  } catch (error) {
    console.error("Error fetching response from Gemini:", error);
    if (error instanceof Error) {
        return `Ocorreu um erro ao contatar o FinAssist: ${error.message}`;
    }
    return "Ocorreu um erro desconhecido ao contatar o FinAssist.";
  }
};