import { GoogleGenAI } from "@google/genai";
import { Trip, Balance } from "../types";

const getSystemInstruction = () => `
You are a witty and helpful travel accountant assistant. 
Your job is to analyze travel expense data and provide a concise, fun, and useful summary.
Output in Markdown format.
`;

export const analyzeSpending = async (trip: Trip, balances: Balance[]) => {
  // 修正 1: 改用 Vite 的方式讀取環境變數 (VITE_ 開頭)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error("API Key is missing! Please set VITE_GEMINI_API_KEY in Vercel.");
    return "API Key is missing. Please check your configuration.";
  }

  // 修正 2: 傳入 apiKey
  const ai = new GoogleGenAI({ apiKey });

  // Prepare data for AI
  const expenseSummary = trip.expenses.map(e => 
    `- ${e.title}: $${e.totalAmount} (Date: ${new Date(e.date).toLocaleDateString()})`
  ).join('\n');

  const participantNames = trip.participants.reduce((acc, p) => {
    acc[p.id] = p.name;
    return acc;
  }, {} as Record<string, string>);

  const balanceSummary = balances.map(b => {
    const name = participantNames[b.participantId];
    return `- ${name}: ${b.net >= 0 ? 'Gets back' : 'Owes'} $${Math.abs(b.net).toFixed(2)}`;
  }).join('\n');

  const prompt = `
    Analyze this trip: "${trip.name}".
    
    Participants: ${trip.participants.map(p => p.name).join(', ')}.
    
    Expenses:
    ${expenseSummary}

    Current Balances:
    ${balanceSummary}

    Please provide:
    1. A quick breakdown of spending categories (guess based on titles like food, transport, tickets).
    2. Who is the "Big Spender" (paid the most upfront) and who is the "Freeloader" (owes the most, say it jokingly).
    3. A brief financial advice or observation for the group.
    
    Keep it short, use emojis, and be conversational.
  `;

  try {
    const response = await ai.models.generateContent({
      // 修正 3: 改用正確的模型名稱
      model: 'gemini-1.5-flash',
      contents: {
        role: 'user',
        parts: [{ text: prompt }]
      },
      config: {
        systemInstruction: {
            role: 'system',
            parts: [{ text: getSystemInstruction() }]
        },
        temperature: 0.7,
      }
    });
    // 修正 4: 根據新版 SDK 調整回傳讀取方式
    return response.text() || "No insight generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Could not generate insights at the moment. Try again later!";
  }
};
