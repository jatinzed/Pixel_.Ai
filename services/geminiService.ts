import { GoogleGenAI, Chat, Modality, Blob, LiveServerMessage, Content, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";

// --- Defensive AI Client Initialization ---
let ai: GoogleGenAI | null = null;

export const getAiClient = (): GoogleGenAI => {
    if (ai) return ai;
    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyCF2B8zGDzKpFQR48zStgq-pVMPb3hh16c";
    if (!apiKey) {
        const errorMessage = "API key is not configured. Please set the GEMINI_API_KEY environment variable.";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    ai = new GoogleGenAI({ apiKey });
    return ai;
};

// Model Hierarchy as requested
const MODEL_PRIORITY = [
    'gemini-3-pro-preview',      // High Intelligence
    'gemini-2.5-flash',          // Balanced
    'gemini-flash-lite-latest',  // Efficient
    'gemini-3-flash-preview'     // Reliable Backup
];

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

/**
 * Utility to execute a content generation call with automatic model fallback.
 */
async function callWithFallback(
    prompt: string | any, 
    config: any = {}, 
    systemInstruction?: string
): Promise<{ response: GenerateContentResponse, usedModel: string }> {
    const client = getAiClient();
    let lastError: any = null;

    for (const modelName of MODEL_PRIORITY) {
        try {
            const response = await client.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction || getDynamicSystemInstruction(),
                    tools: [{ googleSearch: {} }],
                    ...config
                },
            });
            return { response, usedModel: modelName };
        } catch (err) {
            console.warn(`Model ${modelName} failed or exhausted. Trying fallback...`, err);
            lastError = err;
            continue;
        }
    }
    throw lastError || new Error("All models failed to respond.");
}

export const startChat = (history?: Content[]): Chat => {
  const client = getAiClient();
  // Start with the top priority model
  return client.chats.create({
    model: MODEL_PRIORITY[0],
    history: history,
    config: {
      systemInstruction: getDynamicSystemInstruction(),
      tools: [{googleSearch: {}}],
    },
  });
};

/**
 * Enhanced sendMessageStream that can switch models if a session fails
 */
export const sendMessageStream = async (chat: Chat, message: string) => {
    try {
        return await chat.sendMessageStream({ message });
    } catch (err) {
        console.warn("Chat session failed, attempting fallback with fresh session...");
        const history = await chat.getHistory();
        const client = getAiClient();
        
        // Try remaining models in order
        for (const modelName of MODEL_PRIORITY.slice(1)) {
            try {
                const fallbackChat = client.chats.create({
                    model: modelName,
                    history: history,
                    config: {
                        systemInstruction: getDynamicSystemInstruction(),
                        tools: [{googleSearch: {}}],
                    },
                });
                // Note: The caller needs to be aware that the chat object changed if they store it.
                // For this implementation, we return the stream from the new session.
                return await fallbackChat.sendMessageStream({ message });
            } catch (fallbackErr) {
                continue;
            }
        }
        throw err;
    }
};

export const askQuestion = async (prompt: string): Promise<{ text: string, groundingMetadata?: any }> => {
    const { response } = await callWithFallback(prompt);
    return { 
        text: response.text || "No response generated.", 
        groundingMetadata: response.candidates?.[0]?.groundingMetadata 
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
        prompt = `Create a hierarchical Markdown mindmap. Return ONLY raw markdown. Content: ${content}`;
    }

    const { response } = await callWithFallback(
        prompt, 
        { responseMimeType: type === 'mindmap' ? "text/plain" : "application/json" },
        "You are an LLM generator. Return ONLY the requested format."
    );
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