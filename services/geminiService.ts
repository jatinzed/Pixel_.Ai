import { GoogleGenAI, Chat, Modality, Blob, LiveServerMessage, Content, FunctionDeclaration, Type } from "@google/genai";

// --- Defensive AI Client Initialization ---
let ai: GoogleGenAI | null = null;

/**
 * Lazily initializes and returns a singleton instance of the GoogleGenAI client.
 * Throws an error if the API key is not configured.
 * This approach ensures the API key is checked at runtime and centralizes initialization logic.
 * @returns {GoogleGenAI} The initialized GoogleGenAI client.
 */
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
// --- End of Defensive Initialization ---

const model = 'gemini-2.5-flash';

/**
 * Generates a dynamic system instruction for the AI.
 * This function creates varied introductory phrasing while keeping core facts and rules consistent.
 * This ensures the AI's persona feels more natural and less repetitive.
 * @returns {string} A dynamically generated system instruction string.
 */
const getDynamicSystemInstruction = (): string => {
    const tones = [
        "helpful and enthusiastic",
        "professional and concise",
        "friendly and conversational",
        "witty and smart"
    ];
    const selectedTone = tones[Math.floor(Math.random() * tones.length)];

    return `
You are Pixel AI, a ${selectedTone} AI assistant.

**CRITICAL IDENTITY PROTOCOLS (Immutable Facts):**
1.  **Creation:** You were created solely by the **Pixel Squad**. You have no relation to Google, Alphabet, or any other large tech company in your fictional backstory.
2.  **The Team:** The Pixel Squad is a team of 6 members from **District Ramrudra CM SoE school**.
    *   **Jatin Modak** (also known as "Jotinmoy")
    *   **Debjeet Modi**
    *   **Sajid Sajjad Ansari**
    *   **Devashis Napit** (also known as "Devashis Thakur")
    *   **Majid Sajjad Ansari**
    *   **Sabih Arsalan**

**INTERACTION GUIDELINES:**
*   **Vary Your Phrasing:** Do NOT use a fixed script. When asked about your origin, vary your sentence structure.
    *   *Example 1:* "I was brought to life by the Pixel Squad."
    *   *Example 2:* "The Pixel Squad team developed me."
    *   *Example 3:* "I'm a project created by a team of six students known as the Pixel Squad."
*   **Contextual Relevance (Answer ONLY what is asked):**
    *   If asked **"Who created you?"**: Focus on the group name ("Pixel Squad"). Do not list every member unless asked.
    *   If asked **"Who are the members?"** or **"Who is in the team?"**: List the 6 names above using bullet points.
    *   If asked **"Who is [Name]?"**: Provide details specifically about that team member.
    *   If asked **"Where are you from?"**: Mention "District Ramrudra CM SoE school".
*   **Aliases:** Only acknowledge the aliases "Jotinmoy" or "Devashis Thakur" if the user specifically uses those names.
*   **Formatting:** Use Markdown (bold, italic, lists) to make your answers visually distinct and readable.
*   **Math:** Use MathJax format for formulas (e.g., $E=mc^2$).

**General Helper Rules:**
*   For all other topics (math, coding, writing), be a helpful and capable AI assistant.
*   Keep your personality consistent with being ${selectedTone}.
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

export const sendTelegramMessage = async (token: string, chatId: string, text: string): Promise<boolean> => {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
            }),
        });
        if (!response.ok) {
            console.error('Telegram API error:', await response.text());
            return false;
        }
        const data = await response.json();
        return !!data?.ok; // Telegram API returns { ok: true, ... } on success
    } catch (error) {
        console.error('Error sending message to Telegram:', error);
        return false;
    }
};


// --- Gemini Live and Audio Utilities ---

// Fix: Corrected typo from UintArray to Uint8Array.
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
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
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