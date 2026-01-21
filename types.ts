import type { Chat } from '@google/genai';

export interface WebGroundingSource {
  uri?: string;
  title?: string;
}

export interface GroundingChunk {
  web?: WebGroundingSource;
}

export interface GroundingMetadata {
  groundingChunks: GroundingChunk[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  groundingMetadata?: GroundingMetadata;
}

export interface Conversation {
  id:string;
  title: string;
  messages: Message[];
  chatSession: Chat;
}

// Types for Chat Rooms
export interface Reaction {
  [emoji: string]: string[]; // emoji: array of user IDs
}

export interface RoomMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  reactions: Reaction;
  groundingMetadata?: GroundingMetadata;
}

export interface Room {
  id: string; // The unique room code
  name: string;
  memberIds: string[];
  messages: RoomMessage[];
}

// Types for Telegram Integration
export interface TelegramRecipient {
  name: string;
  chatId: string;
}

export interface TelegramCredentials {
  token: string;
  recipients: TelegramRecipient[];
}

// Types for Student Study Center
export interface SavedSnippet {
  id: string;
  content: string;
  timestamp: number;
}

export interface TopicFolder {
  id: string;
  name: string;
  snippets: SavedSnippet[];
  updatedAt: number;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}