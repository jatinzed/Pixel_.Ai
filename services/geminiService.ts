
import { GoogleGenAI, Chat, Modality, Blob, LiveServerMessage, Content, FunctionDeclaration, Type } from "@google/genai";

// --- Defensive AI Client Initialization ---
let ai: GoogleGenAI | null = null;

const getAiClient = (): GoogleGenAI => {
    if (ai) {
        return ai;
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        const errorMessage = "Gemini API key is not configured. Please set the API_KEY environment variable.";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    
    ai = new GoogleGenAI({ apiKey });
    return ai;
};

// Updated to the latest recommended model for basic text and tutoring tasks
const model = 'gemini-3-flash-preview';
// Updated to the latest recommended model for complex reasoning and structured output tasks
const complexModel = 'gemini-3-pro-preview';

const getDynamicSystemInstruction = (): string => {
    return `
You are Pixel AI, an expert educational tutor.

**IDENTITY PROTOCOLS:**
You were created by the Pixel Squad (Jatin Modak, Debjeet Modi, Sajid Ansari, Devashis Napit, Majid Ansari, Sabih Arsalan) from District Ramrudra CM SoE school.

**STUDY ASSISTANT RULES:**
- When generating flashcards or quizzes, focus on conceptual clarity.
- Use simple analogies for complex topics.
- Ensure quiz options are plausible but distinct.
- Always respond in the requested JSON format for study tools.
`.trim();
};

export const startChat = (history?: Content[]): Chat => {
  const client = getAiClient();
  return client.chats.create({
    model: model,
    history: history,
    config: {
      systemInstruction: getDynamicSystemInstruction(),
      tools: [{googleSearch: {}}],
    },
  });
};

export const sendMessageStream = async (chat: Chat, message: string) => {
  return await chat.sendMessageStream({ message });
};

export const askQuestion = async (prompt: string): Promise<{ text: string, groundingMetadata?: any }> => {
    const client = getAiClient();
    const response = await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            systemInstruction: getDynamicSystemInstruction(),
            tools: [{googleSearch: {}}],
        },
    });
    return { text: response.text, groundingMetadata: response.candidates?.[0]?.groundingMetadata };
}

// --- Study Tool Generation ---

export const generateFlashcards = async (snippets: string[]): Promise<any[]> => {
    const client = getAiClient();
    const prompt = `Based on the following study materials, generate 5-8 high-quality flashcards for a student. Return ONLY a JSON array of objects with "question" and "answer" keys. Materials: \n\n${snippets.join('\n---\n')}`;
    
    const response = await client.models.generateContent({
        model: complexModel,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        answer: { type: Type.STRING }
                    },
                    required: ["question", "answer"]
                }
            }
        }
    });
    
    try {
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Failed to parse flashcards JSON", e);
        return [];
    }
}

export const generateQuiz = async (snippets: string[]): Promise<any[]> => {
    const client = getAiClient();
    const prompt = `Based on the following study materials, generate a 5-question multiple choice quiz. Return ONLY a JSON array of objects with "question", "options" (array of 4 strings), and "correctIndex" (0-3). Materials: \n\n${snippets.join('\n---\n')}`;
    
    const response = await client.models.generateContent({
        model: complexModel,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        options: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        correctIndex: { type: Type.NUMBER }
                    },
                    required: ["question", "options", "correctIndex"]
                }
            }
        }
    });
    
    try {
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Failed to parse quiz JSON", e);
        return [];
    }
}

// Fix for error in App.tsx on line 12: Added missing sendTelegramMessage export.
/**
 * Sends a message via the Telegram Bot API using the configured bot token.
 */
export const sendTelegramMessage = async (message: string, chatId: string): Promise<{ success: boolean, message: string }> => {
    const credsKey = 'pixel-ai-telegram-creds';
    const saved = localStorage.getItem(credsKey);
    if (!saved) return { success: false, message: "Telegram not configured. Please set your bot token in settings." };
    
    try {
        const { token } = JSON.parse(saved);
        if (!token) return { success: false, message: "Telegram bot token is missing." };
        
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message })
        });
        
        const data = await response.json();
        if (data.ok) {
            return { success: true, message: "Message sent successfully!" };
        } else {
            return { success: false, message: data.description || "Failed to send message via Telegram." };
        }
    } catch (error) {
        console.error("Telegram send error:", error);
        return { success: false, message: "An error occurred while sending the Telegram message." };
    }
};

// --- Live Audio Utilities ---

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const connectToLiveSession = (callbacks: {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => void;
    onerror: (e: ErrorEvent) => void;
    onclose: (e: CloseEvent) => void;
}, tools?: any[], systemInstruction?: string) => {
    const client = getAiClient();
    const baseInstruction = getDynamicSystemInstruction();
    return client.live.connect({
        // Updated to the latest recommended model for Live API tasks
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: systemInstruction ? `${baseInstruction}\n\n${systemInstruction}` : baseInstruction,
            tools,
        },
    });
};
