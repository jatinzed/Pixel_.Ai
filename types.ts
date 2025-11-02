
import type { Chat } from '@google/genai';

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
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
}

export interface RoomMember {
  id: string;
  status: 'online' | 'offline';
}

export interface Room {
  id: string; // The unique room code
  name: string;
  members: RoomMember[];
  messages: RoomMessage[];
}
