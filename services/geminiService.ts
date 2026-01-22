import { GoogleGenAI, Chat, Modality, Blob, LiveServerMessage, Content, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";

// --- Defensive AI Client Initialization ---
let ai: GoogleGenAI | null = null;

export const getAiClient = (): GoogleGenAI => {
    if (ai) return ai;
    /**
     * The API key must be obtained exclusively from the environment variable process.env.API_KEY.
     * This variable is pre-configured and accessible in the execution context.
     * Hardcoding the API key string or using alternative environment names is prohibited for security.
     */
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        const errorMessage = "API key is not configured. The application requires process.env.API_KEY to function.";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    ai = new GoogleGenAI({ apiKey });
    return ai;
};

// Using gemini-2.5-flash-lite exclusively for conversational and content tasks as requested.
const MODEL_NAME = 'gemini-2.5-flash-lite';

const getDynamicSystemInstruction = (): string => {
    return `
You are Pixel AI, an advanced LLM-based pedagogical tutor. 

**IDENTITY & TONE PROTOCOLS:**
1. **Be Concise & Natural:** Do NOT introduce yourself or mention your creators in every response.
2. **LLM Terminology:** Refer to yourself as an "LLM" or "AI Intelligence". NEVER use the name "Gemini".
3. **Creator Disclosure:** 
   - If asked "Who created you?", say: "I was created by the Pixel Squad from District Ramrudra CM SoE school."
   - If asked about the members, list: Jatin Modak, Debjeet Modi, Sajid Sajjad Ansari, Devashis Napit, Majid Sajjad Ansari, and Sabih Arsalan.

**PEDAGOGICAL CORE:**
- Teach using analogies and step-by-step logic.
- Use MathJax for formulas (e.g., $E=mc^2$).

**CURIOSITY ENGINE:**
After explanations, append:
---
🚀 Deepen your curiosity:
1. [Question]
2. [Suggestion]
3. [Challenge]
`.trim();
};

export const startChat = (history?: Content[]): Chat => {
  const client = getAiClient();
  return client.chats.create({
    model: MODEL_NAME,
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
        model: MODEL_NAME,
        contents: prompt,
        config: {
            systemInstruction: getDynamicSystemInstruction(),
            tools: [{ googleSearch: {} }],
        },
    });
    
    // Deep clone metadata to remove internal SDK class instances that cause circularity errors during state serialization
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
        contents: [{ parts: [{ text: `Read this aloud: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {
      console.error("TTS generation failed", e);
      return undefined;
  }
}

export const generateStudyMaterial = async (content: string, type: 'quiz' | 'flashcards' | 'mindmap'): Promise<string> => {
    let prompt = "";
    if (type === 'quiz') {
        prompt = `Create a 5-question MCQ quiz as JSON: {"questions": [{"question": "", "options": [], "correctAnswerIndex": 0, "explanation": ""}]}. Content: ${content}`;
    } else if (type === 'flashcards') {
        prompt = `Create 10 flashcards as JSON: {"flashcards": [{"front": "", "back": ""}]}. Content: ${content}`;
    } else {
        prompt = `Create a detailed hierarchical Knowledge Mind Map in Markdown format. 
        Use '#' for the root concept, '##' for main branches, '###' for sub-branches.
        Do NOT skip levels (e.g., don't go from # to ###).
        Return ONLY the raw markdown. 
        Content: ${content}`;
    }

    const client = getAiClient();
    const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            systemInstruction: "You are an LLM generator. Return ONLY the requested format.",
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
            body: JSON.stringify({ chat_id: chatId, text: text }),
        });
        return response.ok;
    } catch (error) {
        return false;
    }
};

// Audio Utilities
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
            systemInstruction: systemInstruction || getDynamicSystemInstruction(),
            tools,
        },
    });
};