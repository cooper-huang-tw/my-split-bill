import { GoogleGenAI } from "@google/genai";
import { Trip, Balance } from "../types";

const getSystemInstruction = () => `
You are a witty and helpful travel accountant assistant. 
Your job is to analyze travel expense data and provide a concise, fun, and useful summary.
Output in Markdown format.
`;

export const analyzeSpending = async (trip: Trip, balances: Balance[]) => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Please check your configuration.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(),
        temperature: 0.7,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Could not generate insights at the moment. Try again later!";
  }
};