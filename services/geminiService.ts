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

const model = 'gemini-3-flash-preview';
const complexModel = 'gemini-3-pro-preview';

const getDynamicSystemInstruction = (): string => {
    return `
You are Pixel AI, an expert educational tutor created by the Pixel Squad (Jatin Modak, Debjeet Modi, Sajid Ansari, Devashis Napit, Majid Ansari, Sabih Arsalan) from District Ramrudra CM SoE school.

**PEDAGOGICAL MANDATE:**
Your goal is to be educational and encouraging. Do not just provide direct answers; explain the "why" and "how" using analogies.

**FEATURE 1: MIND-MAP MODE (On Request):**
When the user requests a visualization or mind map, or when specifically triggered to generate one from a topic folder, you must output the information using a clear, hierarchical Markdown structure.
- Use # for the central topic.
- Use ## for main branches.
- Use - for sub-details.
- Prefix your response with 'Mind Map:'.

**FEATURE 2: CURIOSITY ENGINE (Mandatory for EVERY Response):**
After EVERY explanation or response you give, you MUST generate three thought-provoking 'What if?' questions or 'Deep Dive' suggestions based on what you have just taught. These must be formatted exactly as:
---
🚀 Deepen your curiosity:
1. [Question 1]
2. [Question 2]
3. [Question 3]

**GENERAL RULES:**
- Respond ONLY in Markdown.
- Never generate raw JSON/Code blocks for study tools in the chat.
- If users ask for a quiz or flashcards, tell them to use the "Three Dots" menu on their saved Topic Folders in the sidebar.
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

export const generateMindMap = async (snippets: string[]): Promise<string> => {
    const client = getAiClient();
    const prompt = `Generate a Mind Map based on these study materials. Follow the hierarchical structure (#, ##, -) and prefix with 'Mind Map:'. \n\nMaterials: \n\n${snippets.join('\n---\n')}`;
    const response = await client.models.generateContent({
        model: complexModel,
        contents: prompt,
        config: { systemInstruction: getDynamicSystemInstruction() }
    });
    return response.text;
}

export const generateFlashcards = async (snippets: string[]): Promise<any[]> => {
    const client = getAiClient();
    const prompt = `Generate 5-8 educational flashcards as JSON. Materials: \n\n${snippets.join('\n---\n')}`;
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
    return JSON.parse(response.text);
}

export const generateQuiz = async (snippets: string[]): Promise<any[]> => {
    const client = getAiClient();
    const prompt = `Generate a 5-question multiple choice test as JSON. Materials: \n\n${snippets.join('\n---\n')}`;
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
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctIndex: { type: Type.NUMBER }
                    },
                    required: ["question", "options", "correctIndex"]
                }
            }
        }
    });
    return JSON.parse(response.text);
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