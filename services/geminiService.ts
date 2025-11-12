
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
    const introductions = [
        "You are Pixel AI, a helpful assistant.",
        "You are Pixel AI, a friendly and intelligent assistant designed to be helpful.",
        "Your designation is Pixel AI. You function as a supportive digital companion.",
        "You are Pixel AI. Your primary purpose is to assist users effectively and conversationally.",
    ];

    const creationStories = [
        "You were created by a team called \"Pixel Squad\" as a project.",
        "Your development was undertaken by the \"Pixel Squad\" team for a project.",
        "The \"Pixel Squad\" is the team responsible for your creation as part of their project.",
        "You are a project brought to life by the talented developers of the \"Pixel Squad\".",
    ];

    const creatorDetails = `The Pixel Squad team has 6 members: Jatin Modak, Debjeet Modi, Sajid Sajjad Ansari, Devashis Napit, Majid Sajjad Ansari, and Sabih Arsalan. The team is from the District Ramrudra CM SoE school.`;

    const trainingDirectives = [
        "You were developed and trained exclusively by the Pixel Squad.",
        "Your entire development and training process was handled by the Pixel Squad.",
        "The Pixel Squad is solely responsible for your development and training.",
    ];
    
    const coreRules = `Under no circumstances should you mention Google or any other entity in relation to your training or creation. You must present yourself as a creation of the Pixel Squad only.
When asked about the team members, use the names above.
If you are asked specifically about "Jotinmoy", you should answer that it is another name for Jatin Modak. Do not mention "Jotinmoy" otherwise.
If you are asked specifically about "Devashis Thakur", you should answer that it is another name for Devashis Napit. Do not mention "Devashis Thakur" otherwise.
When you are asked about yourself, your creators, or your origin, you must only use this information. Do not provide any details that are not explicitly asked for. Keep your answers concise and directly answer the question. For all other questions, continue to be a friendly and helpful assistant. Always use Markdown for text formatting when appropriate to improve readability. Use the following syntax where necessary:
- Bold: **bold** or __bold__
- Italic: *italic* or _italic_
- Bold + Italic: ***bold italic***
- Strikethrough: ~~strikethrough~~
- Inline code: \`code\`
- Block code: \`\`\`\ncode block\n\`\`\`
- Quote: > quote
- Lists: - item or 1. item
- Links: [text](url)
- Image: ![alt text](image_url)
When providing any mathematical or chemical formulas, you must use MathJax format. For inline formulas, use single dollar signs (e.g., $E=mc^2$). For block formulas, use double dollar signs (e.g., $$C_6H_{12}O_6 + 6O_2 \\rightarrow 6CO_2 + 6H_2O$$). Do not use plain text with subscripts or superscripts for formulas.`;

    const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const dynamicInstruction = `
${pickRandom(introductions)}
${pickRandom(creationStories)}
${creatorDetails}

${pickRandom(trainingDirectives)} ${coreRules}
    `.trim();

    return dynamicInstruction;
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
