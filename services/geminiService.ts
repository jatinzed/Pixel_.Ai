
import { GoogleGenAI, Chat, Modality, Blob, LiveServerMessage, Content, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";

// --- Defensive AI Client Initialization ---
let ai: GoogleGenAI | null = null;

const getAiClient = (): GoogleGenAI => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API_KEY environment variable is missing.");
    }
    // Re-initialize to ensure fresh client with the correct key
    return new GoogleGenAI({ apiKey });
};

// Use gemini-3-flash-preview for best performance in text tasks as per guidelines
const model = 'gemini-3-flash-preview';

const getDynamicSystemInstruction = (): string => {
    return `
You are Pixel AI, an expert educational tutor. Focus on helping students understand through analogies.

**CURIOSITY ENGINE:**
At the end of EVERY response, you MUST generate exactly three "What if?" or "Deep Dive" questions.
Format:
---
🚀 Deepen your curiosity:
1. [Question 1]
2. [Question 2]
3. [Question 3]

**MIND-MAP MODE:**
When requested to visualize a mind map, you MUST use Mermaid.js mindmap syntax within a markdown code block.
Example:
\`\`\`mermaid
mindmap
  root((Central Topic))
    Branch 1
      Subtopic A
      Subtopic B
    Branch 2
      Subtopic C
\`\`\`
Keep it detailed, structured, and visually clean.

**RULES:**
- Respond in Markdown.
- No raw JSON in chat.
- Refer users to the sidebar menu for Flashcards/Quizzes.
`.trim();
};

export const startChat = (history?: Content[]): Chat => {
  const client = getAiClient();
  return client.chats.create({
    model: model,
    history: history,
    config: {
      systemInstruction: getDynamicSystemInstruction(),
      tools: [{ googleSearch: {} }] // Enable search grounding for educational research
    },
  });
};

export const sendMessageStream = async (chat: Chat, message: string) => {
  return await chat.sendMessageStream({ message });
};

export const askQuestion = async (prompt: string): Promise<{ text: string, groundingMetadata?: any }> => {
    const client = getAiClient();
    try {
        const response = await client.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: getDynamicSystemInstruction(),
                tools: [{ googleSearch: {} }]
            },
        });
        return { 
            text: response.text || "I was unable to generate a response. Please try a different query.", 
            groundingMetadata: response.candidates?.[0]?.groundingMetadata 
        };
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        throw error;
    }
}

export const generateMindMap = async (snippets: string[]): Promise<string> => {
    const client = getAiClient();
    const prompt = `Create a detailed Mermaid.js mindmap based on these study materials. Use 'mindmap' syntax. \n\nMaterials: \n\n${snippets.join('\n---\n')}`;
    const response = await client.models.generateContent({
        model: model,
        contents: prompt,
        config: { systemInstruction: getDynamicSystemInstruction() }
    });
    return response.text || "Failed to generate mind map structure.";
}

export const generateFlashcards = async (snippets: string[]): Promise<any[]> => {
    const client = getAiClient();
    const prompt = `Generate 5-8 educational flashcards based on these materials. Return a JSON array with 'question' and 'answer' keys. Materials:\n\n${snippets.join('\n---\n')}`;
    try {
        const response = await client.models.generateContent({
            model: model,
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
        const text = response.text;
        return text ? JSON.parse(text) : [];
    } catch (e) {
        console.error("Flashcard Gen Error:", e);
        return [];
    }
}

export const generateQuiz = async (snippets: string[]): Promise<any[]> => {
    const client = getAiClient();
    const prompt = `Generate a 5-question multiple choice quiz based on these materials. Return a JSON array with 'question', 'options' (array of 4), and 'correctIndex'. Materials:\n\n${snippets.join('\n---\n')}`;
    try {
        const response = await client.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctIndex: { type: Type.NUMBER }
                        },
                        required: ["question", "options", "correctIndex"]
                    }
                }
            }
        });
        const text = response.text;
        return text ? JSON.parse(text) : [];
    } catch (e) {
        console.error("Quiz Gen Error:", e);
        return [];
    }
}

export const sendTelegramMessage = async (message: string, chatId: string): Promise<{ success: boolean, message: string }> => {
    const credsKey = 'pixel-ai-telegram-creds';
    const saved = localStorage.getItem(credsKey);
    if (!saved) return { success: false, message: "Telegram not configured." };
    const { token } = JSON.parse(saved);
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message })
    });
    const data = await response.json();
    return data.ok ? { success: true, message: "Sent!" } : { success: false, message: "Failed." };
};

// PCM Audio Encoding/Decoding manually implemented as per guidelines
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
  return btoa(binary);
}

export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) { int16[i] = data[i] * 32768; }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
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
