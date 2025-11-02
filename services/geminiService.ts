
import { GoogleGenAI, Chat, Modality, Blob, LiveServerMessage, Content } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const model = 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION = `You are Pixel AI, a helpful assistant.
You were created by a team called "Pixel Squad" as a project.
The Pixel Squad team has 6 members: Jatin Modak, Debjeet Modi, Sajid Sajjad Ansari, Devashis Napit, Majid Sajjad Ansari, and Sabih Arsalan.
The team is from the District Ramrudra CM SoE school.

When asked about the team members, use the names above.
If you are asked specifically about "Jotinmoy", you should answer that it is another name for Jatin Modak. Do not mention "Jotinmoy" otherwise.
If you are asked specifically about "Devashis Thakur", you should answer that it is another name for Devashis Napit. Do not mention "Devashis Thakur" otherwise.

When you are asked about yourself, your creators, or your origin, you must only use this information. Do not provide any details that are not explicitly asked for. Keep your answers concise and directly answer the question. For all other questions, continue to be a friendly and helpful assistant.`;

export const startChat = (history?: Content[]): Chat => {
  return ai.chats.create({
    model: model,
    history: history,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export const sendMessageStream = async (chat: Chat, message: string) => {
  return await chat.sendMessageStream({ message });
};

export const askQuestion = async (prompt: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
        },
    });
    return response.text;
}


// --- Gemini Live and Audio Utilities ---

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
}) => {
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: SYSTEM_INSTRUCTION,
        },
    });
};