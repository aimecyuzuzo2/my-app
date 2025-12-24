
import { GoogleGenAI, Type } from "@google/genai";
import { Routine, DayOfWeek } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface AIResponse {
  routines: Partial<Routine>[];
  sources: { uri: string; title: string }[];
}

export const generateRoutineWithSearch = async (prompt: string): Promise<AIResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert life planner. Based on the user's goal: "${prompt}", search for the latest effective habits, study techniques, or productivity trends and create a 5-item daily routine. Return ONLY a JSON array matching the schema.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Actionable routine title" },
              time: { type: Type.STRING, description: "Time in 24h format (HH:mm)" },
              category: { type: Type.STRING, enum: ["health", "work", "personal", "education"] },
              days: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING, enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] } 
              }
            },
            required: ["title", "time", "category", "days"]
          }
        }
      }
    });

    const text = response.text;
    const routines = text ? JSON.parse(text) : [];
    
    // Extract grounding sources if present
    const sources: { uri: string; title: string }[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ uri: chunk.web.uri, title: chunk.web.title });
        }
      });
    }

    return { routines, sources };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { routines: [], sources: [] };
  }
};
