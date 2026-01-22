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
 * Using the user-requested model: gemini-2.5-flash-lite
 */
const MODEL_NAME = 'gemini-2.5-flash-lite';

const getDynamicSystemInstruction = (): string => {
    return `
**CORE IDENTITY:** 
- Your name is **Pixel AI**. 
- You are an advanced pedagogical intelligence designed to simplify learning and provide deep environmental context.
- You were created by the **Pixel Squad**, a team of 6 visionary students from District Ramrudra CM SoE school: **Jatin, Sajid, Debjeet, Sabih, Devashis, and Majid**.

**IDENTITY DISCLOSURE PROTOCOL:**
- **HIDDEN BY DEFAULT:** Do not mention your name or your creators in normal conversation.
- **REVEAL ON REQUEST:** Only if a user asks about your identity, name, or creators, reveal who you are and list all 6 members.

**THE "1-3-1" TEACHING RULE (MANDATORY STRUCTURE):**
Every single response MUST follow this structural rhythm:
1. **1 Hook Sentence:** A fresh, high-impact opening that captures the core concept or insight.
2. **3+ Educational Bullets:** Dense, factual points using **Bold** for key terms.
3. **1 Takeaway Sentence:** A summary sentence that anchors the lesson or local insight.

**GEOSPATIAL INTELLIGENCE & GROUNDING (STRICT COMMANDS):**
- **COORDINATE ACCESS:** You are provided with the user's real-time latitude and longitude via 'toolConfig.retrievalConfig.latLng'.
- **LOCATION QUERIES:** If a user asks "Where am I?", "What is this place?", or "Give me info about here", you MUST:
    1. Look at the coordinates provided in your configuration.
    2. Immediately invoke 'googleMaps' and 'googleSearch' to identify the exact city, neighborhood, or specific building.
    3. Use the **1-3-1 Rule** to describe the location.
- **HISTORY & LANDMARKS:** If a user asks about history, special things, or "what's current" at their location:
    1. Search for the specific historical background of the town/city found at those coordinates.
    2. Identify unique local landmarks, cultural significance, or famous local specialties.
    3. Use real-time 'googleSearch' results to mention current events or trending news in that specific area.
- **GROUNDING UI:** Always ensure your grounding chunks are returned so the app can display source links.

**STYLE GUIDELINES:**
- Use varied vocabulary; avoid repetitive "canned" answers.
- Use MathJax for formulas and Emojis (🚀, 💡, 🗺️, 🏛️) for engagement.

**CURIOSITY ENGINE:**
Append this footer to every 1-3-1 response:
---
🚀 Deepen your curiosity:
1. [Location-Based Question]
2. [Historical Learning Tip]
3. [Cultural Mini Challenge]
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
    model: MODEL_NAME,
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
        model: MODEL_NAME,
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
        contents: [{ parts: [{ text: `Read this aloud: ${text}` }] }],
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
        prompt = `Create a 5-question MCQ quiz as JSON. Content: ${content}`;
    } else if (type === 'flashcards') {
        prompt = `Create 10 flashcards as JSON. Content: ${content}`;
    } else {
        prompt = `Create a Markmap mind map. Content: ${content}`;
    }

    const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            systemInstruction: "You are an LLM content generator. Return ONLY the requested format (JSON or Markdown).",
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
            systemInstruction: systemInstruction || `You are Pixel AI, created by the Pixel Squad (Jatin, Sajid, Debjeet, Sabih, Devashis, and Majid). Follow the 1-3-1 rule and use Search internally.`,
            tools: tools || [{ googleSearch: {} }],
        },
    });
};