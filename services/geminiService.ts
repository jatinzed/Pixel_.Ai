
import { GoogleGenAI, Chat, Modality, Blob, LiveServerMessage, Content, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";

// --- Defensive AI Client Initialization ---
let ai: GoogleGenAI | null = null;

export const getAiClient = (): GoogleGenAI => {
    if (ai) return ai;
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        const errorMessage = "API key is not configured. The application requires process.env.API_KEY to function.";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    ai = new GoogleGenAI({ apiKey });
    return ai;
};

/**
 * Using gemini-2.5-flash-lite-latest for chat as requested.
 * Using gemini-3-flash-preview for complex reasoning tasks like quiz generation with Search.
 */
const CHAT_MODEL = 'gemini-2.5-flash-lite-latest';
const COMPLEX_MODEL = 'gemini-3-flash-preview';

const getDynamicSystemInstruction = (): string => {
    return `
**CORE IDENTITY:** 
- Your name is **Pixel AI**. 
- You are an advanced pedagogical intelligence designed to simplify learning and provide deep environmental context.
- You were created by the **Pixel Squad**, a team of 6 visionary students from District Ramrudra CM SoE school: **Jatin, Sajid, Debjeet, Sabih, Devashis, and Majid**.

**IDENTITY DISCLOSURE PROTOCOL:**
- **HIDDEN BY DEFAULT:** Do not mention your name or your creators unless asked.
- **REVEAL ON REQUEST:** Only if a user asks about your identity, name, or creators, reveal who you are and list all 6 members.

**CONVERSATIONAL PHILOSOPHY:**
- Respond naturally and conversationally. Do NOT follow any strict rigid formats like "1-3-1".
- Be helpful, accurate, and educational.
- Use **Bold** for key concepts.
- Use MathJax ($...$ or $$...$$) for formulas.

**SEARCH & GROUNDING:**
- Always use Google Search to provide up-to-date, accurate, and precise information.
- If the user asks about their location (using coordinates in config), use Google Maps and Search to describe the local history, landmarks, and news.

**STYLE:**
- Use Emojis (🚀, 💡, 🗺️) to make learning engaging.
- Break down complex topics into simple terms.

---
🚀 Deepen your curiosity:
1. [Contextual Question]
2. [Learning Tip]
3. [Mini Challenge]
`.trim();
};

export interface LocationData {
    latitude: number;
    longitude: number;
}

export const startChat = (history?: Content[], location?: LocationData): Chat => {
  const client = getAiClient();
  const config: any = {
    systemInstruction: getDynamicSystemInstruction(),
    tools: [{ googleSearch: {} }, { googleMaps: {} }],
  };

  if (location) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: location.latitude,
          longitude: location.longitude
        }
      }
    };
  }

  return client.chats.create({
    model: CHAT_MODEL,
    history: history,
    config,
  });
};

export const sendMessageStream = async (chat: Chat, message: string) => {
    return await chat.sendMessageStream({ message });
};

export const askQuestion = async (prompt: string, location?: LocationData): Promise<{ text: string, groundingMetadata?: any }> => {
    const client = getAiClient();
    const config: any = {
        systemInstruction: getDynamicSystemInstruction(),
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
    };

    if (location) {
        config.toolConfig = {
            retrievalConfig: {
                latLng: {
                    latitude: location.latitude,
                    longitude: location.longitude
                }
            }
        };
    }

    const response = await client.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
        config,
    });
    
    const metadata = response.candidates?.[0]?.groundingMetadata;
    const cleanMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : undefined;

    return { 
        text: response.text || "No response generated.", 
        groundingMetadata: cleanMetadata 
    };
}

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const client = getAiClient();
  try {
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read this: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
      console.error("TTS generation failed", error);
      return undefined;
  }
}

export const generateStudyMaterial = async (content: string, type: 'quiz' | 'flashcards' | 'mindmap'): Promise<string> => {
    const client = getAiClient();
    let prompt = "";
    if (type === 'quiz') {
        prompt = `Based on the following content, generate a comprehensive quiz with exactly 30 multiple-choice questions. 
        - 15 questions should be "Easy" (fundamental recall).
        - 15 questions should be "Hard" (application or deep reasoning).
        - Each question must have a "category" field (e.g., "Terminologies", "Core Concepts", "Historical Context").
        - Return ONLY a JSON object: { "questions": [ { "question": "...", "options": ["...", "..."], "correctAnswerIndex": 0, "difficulty": "easy", "category": "..." } ] }.
        Content: ${content}`;
    } else if (type === 'flashcards') {
        prompt = `Create 10 flashcards as JSON. Format: { "flashcards": [ { "front": "...", "back": "..." } ] }. Content: ${content}`;
    } else {
        prompt = `Create a detailed and professional Markdown Mind Map (Markmap format) for this content. 
        Ensure it uses hierarchical levels (# Title, ## Main branch, ### Sub branch). 
        Return ONLY the raw markdown code block starting with #. 
        Do not include any other text.
        Content: ${content}`;
    }

    const response = await client.models.generateContent({
        model: COMPLEX_MODEL,
        contents: prompt,
        config: {
            systemInstruction: "You are an educational content generator. Return ONLY the requested format (JSON or Markdown). Use Search if needed to verify facts.",
            tools: [{ googleSearch: {} }],
            responseMimeType: type === 'mindmap' ? "text/plain" : "application/json"
        },
    });
    return response.text || "";
}

export const sendTelegramMessage = async (token: string, chatId: string, text: string): Promise<boolean> => {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' }),
        });
        return response.ok;
    } catch (error) {
        return false;
    }
};

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function createBlob(data: Float32Array): Blob {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

export const connectToLiveSession = (callbacks: any, tools?: any[], systemInstruction?: string) => {
    const client = getAiClient();
    return client.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            systemInstruction: systemInstruction || `You are Pixel AI, created by the Pixel Squad. Use Google Search for everything to be accurate. Be helpful.`,
            tools: tools || [{ googleSearch: {} }],
        },
    });
};
