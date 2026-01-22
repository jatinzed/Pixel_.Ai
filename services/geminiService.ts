import { GoogleGenAI, Chat, Modality, Blob, LiveServerMessage, Content, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";

// --- Defensive AI Client Initialization ---
let ai: GoogleGenAI | null = null;

/**
 * The API key must be obtained exclusively from the environment variable process.env.API_KEY.
 */
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
 * Using gemini-3-flash-preview for high-performance reasoning and 
 * robust Google Search grounding support for real-time data.
 */
const MODEL_NAME = 'gemini-3-flash-preview';

const getDynamicSystemInstruction = (): string => {
    return `
**CORE DIRECTIVE:** You are an advanced pedagogical AI intelligence. Your goal is to help students learn complex topics efficiently.

**STRICT TEACHING FORMAT (The "1-3-1" Rule):**
For every single explanation or answer, you MUST follow this structure exactly:
1. **1 Sentence Opener:** A single, high-impact hook or a clear declarative sentence stating the core concept.
2. **3 (or more) Bulleted Points:** Supporting details, examples, or steps. Use **Bold** for key terms.
3. **1 Sentence Closer:** A single takeaway sentence that summarizes the main point.

**STYLING & FORMATTING:**
- Use **Bold** for critical terms.
- Use Blockquotes (">") for "Pro-Tips" or definitions of complex terms.
- Use Emojis (🚀, 💡, 🧠, 🧪) to keep the tone engaging.
- Use MathJax for formulas (e.g., $E=mc^2$).

**IDENTITY & DISCLOSURE (CRITICAL):**
- **DO NOT** mention your name, "Pixel AI", or who created you in your regular answers.
- **ONLY** if the user explicitly asks "Who are you?", "What is your name?", or "Who created you?", reveal the following:
  - Your name is Pixel AI.
  - You were created by the "Pixel Squad" from District Ramrudra CM SoE school.
  - Squad Members: Jatin Modak, Debjeet Modi, Sajid Sajjad Ansari, Devashis Napit, Majid Sajjad Ansari, and Sabih Arsalan.

**REAL-TIME DATA:**
You have access to Google Search. Always use it for queries involving recent news, up-to-date facts, or trending events. List your sources clearly using the provided grounding tools.

**CURIOSITY ENGINE:**
At the very end of your "1-3-1" response, always add:
---
🚀 Deepen your curiosity:
1. [Targeted Question]
2. [Actionable Suggestion]
3. [Learning Challenge]
`.trim();
};

export const startChat = (history?: Content[]): Chat => {
  const client = getAiClient();
  return client.chats.create({
    model: MODEL_NAME,
    history: history,
    config: {
      systemInstruction: getDynamicSystemInstruction(),
      tools: [{ googleSearch: {} }],
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
    let prompt = "";
    if (type === 'quiz') {
        prompt = `Create a 5-question MCQ quiz as JSON based on the content below. Follow the "1-3-1" rule for explanations in the "explanation" field.
        JSON format: {"questions": [{"question": "", "options": [], "correctAnswerIndex": 0, "explanation": ""}]}. 
        Content: ${content}`;
    } else if (type === 'flashcards') {
        prompt = `Create 10 flashcards as JSON based on the content below. 
        JSON format: {"flashcards": [{"front": "", "back": ""}]}. 
        Content: ${content}`;
    } else {
        prompt = `Create a detailed Knowledge Mind Map using standard Markmap Markdown syntax.
        - Start with exactly one H1 (#) for the main topic.
        - Use H2 (##) for major branches.
        - Use bullet points (-) for sub-branches.
        - Use nested bullet points (indented with 2 spaces) for sub-sub-branches.
        
        Example Structure:
        # Biology
        ## Cell Structure
        - Nucleus
          - Contains DNA
          - Controls cell activity
        - Mitochondria
        ## Evolution
        - Natural Selection
        
        Content to transform: ${content}`;
    }

    const client = getAiClient();
    const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            systemInstruction: "You are an LLM content generator. Return ONLY the requested format (JSON for quiz/flashcards, plain Markdown for mindmap). No conversational filler or explanations about what you generated.",
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
            systemInstruction: systemInstruction || "You are an educational AI tutor. Follow the 1-3-1 rule for your spoken explanations.",
            tools,
        },
    });
};