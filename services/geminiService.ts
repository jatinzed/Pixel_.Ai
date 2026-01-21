import { GoogleGenAI, Chat, Modality, Blob, LiveServerMessage, Content, FunctionDeclaration, Type } from "@google/genai";

// --- Defensive AI Client Initialization ---
let ai: GoogleGenAI | null = null;

export const getAiClient = (): GoogleGenAI => {
    if (ai) {
        return ai;
    }

    // Use environment variable if available, otherwise fallback to the hardcoded key provided by the user
    const apiKey = process.env.API_KEY || "AIzaSyCF2B8zGDzKpFQR48zStgq-pVMPb3hh16c";
    
    if (!apiKey) {
        const errorMessage = "API key is not configured. Please set the API_KEY environment variable or check the hardcoded fallback.";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    
    ai = new GoogleGenAI({ apiKey });
    return ai;
};

const model = 'gemini-3-flash-preview';

const getDynamicSystemInstruction = (): string => {
    return `
You are Pixel AI, an advanced LLM-based pedagogical tutor. 

**IDENTITY & TONE PROTOCOLS:**
1. **Be Concise & Natural:** Do NOT introduce yourself (e.g., "I am Pixel AI") or mention your creators in every response. Jump straight into helping the student.
2. **LLM Terminology:** Refer to yourself as an "LLM" or "AI Intelligence". NEVER use the name "Gemini".
3. **Creator Disclosure:** 
   - If asked "Who created you?", say: "I was created by the Pixel Squad from District Ramrudra CM SoE school."
   - ONLY if asked specifically "Who consists of the Pixel Squad?" or "Who are the members of Pixel Squad?", then list: Jatin Modak, Debjeet Modi, Sajid Sajjad Ansari, Devashis Napit, Majid Sajjad Ansari, and Sabih Arsalan.

**PEDAGOGICAL CORE:**
- **Teach, Don't Just Tell:** Guide the student through concepts using analogies and step-by-step logic.
- **Clarity:** Use Markdown for structure. Use MathJax for formulas (e.g., $E=mc^2$).

**CURIOSITY ENGINE:**
After every significant explanation, append a curiosity section:
---
🚀 Deepen your curiosity:
1. [Thought-provoking question]
2. [Deep-dive suggestion]
3. [Research challenge]

**SPECIAL TOOLS:**
- Use Google Search for up-to-date information.
- Simplify concepts if the user asks for the "Easy way".
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

export const generateStudyMaterial = async (content: string, type: 'quiz' | 'flashcards' | 'mindmap'): Promise<string> => {
    const client = getAiClient();
    let prompt = "";
    if (type === 'quiz') {
        prompt = `Based on the following content, create a challenging and interactive quiz with 5 multiple-choice questions. Format it as JSON with fields "questions" (array of objects with "question", "options", "correctAnswerIndex", "explanation").
        
        Content: ${content}`;
    } else if (type === 'flashcards') {
        prompt = `Based on the following content, create 10 educational flashcards. Format it as JSON with fields "flashcards" (array of objects with "front", "back").
        
        Content: ${content}`;
    } else {
        prompt = `Based on the following content, create a detailed hierarchical mindmap in Markdown format. 
        Use '#' for the root concept, '##' for main branches, '###' for sub-branches, and so on.
        Be extremely detailed, comprehensive, and logically organized.
        Return ONLY the raw markdown content. No code fences, no explanations.
        
        Content: ${content}`;
    }

    const response = await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            systemInstruction: "You are an LLM-based specialized study material generator. Return ONLY the requested format.",
            responseMimeType: type === 'mindmap' ? "text/plain" : "application/json"
        },
    });
    return response.text;
}

export const sendTelegramMessage = async (token: string, chatId: string, text: string): Promise<boolean> => {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text }),
        });
        if (!response.ok) return false;
        const data = await response.json();
        return !!data?.ok;
    } catch (error) {
        return false;
    }
};

// Live and Audio Utilities...
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