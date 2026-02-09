import { GoogleGenAI } from "@google/genai";

export const getVocalTip = async (): Promise<string> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key found for Gemini");
    return "Keep practicing your scales every day!";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Give me one short, fun, and encouraging tip for a beginner singer practicing solfege scales. Maximum 20 words.",
    });

    return response.text || "Sing from your diaphragm and have fun!";
  } catch (error) {
    console.error("Error fetching tip from Gemini:", error);
    return "Relax your jaw and breathe deeply.";
  }
};