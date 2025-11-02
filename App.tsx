
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import RoomView from './components/RoomView';
import NotepadModal from './components/NotepadModal';
import RoomModal from './components/RoomModal';
import { MenuIcon } from './components/Icons';
import { Conversation, Message, Room, RoomMessage } from './types';
import { startChat, sendMessageStream, askQuestion } from './services/geminiService';
import type { Content } from '@google/genai';

const USER_ID_KEY = 'chat-ai-user-id';
const CONVERSATIONS_KEY_PREFIX = 'chat-ai-conversations-';
const ROOMS_KEY_PREFIX = 'chat-ai-rooms-';

const getUserId = (): string => {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
        userId = `user_${crypto.randomUUID().substring(0, 8)}`;
        localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
}

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  const handleNewChat = useCallback(() => {
    setIsLoading(false);
    setActiveRoomId(null);
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      chatSession: startChat(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
  }, []);

  // Load conversations from local storage
  useEffect(() => {
      if (!userId) return;
      const key = `${CONVERSATIONS_KEY_PREFIX}${userId}`;
      const saved = localStorage.getItem(key);
      
      if (saved) {
          try {
              const savedConversations: Omit<Conversation, 'chatSession'>[] = JSON.parse(saved);
              if (savedConversations.length > 0) {
                  const rehydrated = savedConversations.map(c => ({
                      ...c,
                      chatSession: startChat(c.messages.map(msg => ({
                          role: msg.role,
                          parts: [{ text: msg.content }],
                      }))),
                  }));
                  setConversations(rehydrated);
                  setActiveConversationId(rehydrated[0]?.id || null);
              } else { handleNewChat(); }
          } catch (e) { console.error("Failed to load conversations:", e); localStorage.removeItem(key); handleNewChat(); }
      } else { handleNewChat(); }
  }, [userId, handleNewChat]);

  // Save conversations to local storage
  useEffect(() => {
      if (!userId || conversations.length === 0) return;
      const toSave = conversations.filter(c => c.messages.length > 0).map(({ chatSession, ...rest }) => rest);
      if (toSave.length > 0) {
          localStorage.setItem(`${CONVERSATIONS_KEY_PREFIX}${userId}`, JSON.stringify(toSave));
      } else {
          localStorage.removeItem(`${CONVERSATIONS_KEY_PREFIX}${userId}`);
      }
  }, [conversations, userId]);

  // Load rooms from local storage
  useEffect(() => {
    if (!userId) return;
    const key = `${ROOMS_KEY_PREFIX}${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const savedRooms: Room[] = JSON.parse(saved);
        setRooms(savedRooms);
      } catch (e) { console.error("Failed to load rooms:", e); localStorage.removeItem(key); }
    }
  }, [userId]);

  // Save rooms to local storage
  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(`${ROOMS_KEY_PREFIX}${userId}`, JSON.stringify(rooms));
  }, [rooms, userId]);


  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const handleOpenNotepad = () => setIsNotepadOpen(true);
  const handleCloseNotepad = () => setIsNotepadOpen(false);
  const handleOpenRoomModal = () => setIsRoomModalOpen(true);
  const handleCloseRoomModal = () => setIsRoomModalOpen(false);

  const handleSelectConversation = (id: string) => {
    setActiveRoomId(null);
    setActiveConversationId(id);
  };
  
  const handleSelectRoom = (id: string) => {
    setActiveConversationId(null);
    setActiveRoomId(id);
  };

  const handleCreateRoom = (): string => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom: Room = {
      id: roomCode,
      name: `Room ${roomCode}`,
      members: [{id: userId, status: 'online'}, {id: 'PixelBot', status: 'online'}],
      messages: [{
        id: Date.now().toString(),
        senderId: 'PixelBot',
        text: `Welcome to the room! Your room code is ${roomCode}. Share it with others to invite them.`,
        timestamp: new Date().toISOString(),
        reactions: {}
      }],
    };
    setRooms(prev => [...prev, newRoom]);
    handleSelectRoom(newRoom.id);
    return roomCode;
  };
  
  const handleJoinRoom = (roomCode: string) => {
    if(rooms.some(r => r.id === roomCode)) {
      handleSelectRoom(roomCode);
      return;
    };
    const newRoom: Room = {
      id: roomCode,
      name: `Room ${roomCode}`,
      members: [{id: userId, status: 'online'}, {id: 'PixelBot', status: 'online'}],
      messages: [{
        id: Date.now().toString(),
        senderId: 'PixelBot',
        text: 'Welcome! You have joined the room.',
        timestamp: new Date().toISOString(),
        reactions: {}
      }],
    };
    setRooms(prev => [...prev, newRoom]);
    handleSelectRoom(newRoom.id);
  };

  const handleSendMessage = async (prompt: string) => {
    if (!activeConversationId) return;
    setIsLoading(true);

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: prompt };
    const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', content: '' };
    
    const activeConvo = conversations.find(c => c.id === activeConversationId);
    const isFirstMessage = activeConvo?.messages.length === 0;
    const newTitle = isFirstMessage ? prompt.substring(0, 25) + (prompt.length > 25 ? '...' : '') : activeConvo?.title;

    setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, title: newTitle || c.title, messages: [...c.messages, userMessage, modelMessage] } : c));

    try {
      const chatSession = conversations.find(c => c.id === activeConversationId)?.chatSession;
      if (!chatSession) throw new Error("Chat session not found");

      const stream = await sendMessageStream(chatSession, prompt);
      
      for await (const chunk of stream) {
        setConversations(prev => prev.map(c => {
            if (c.id === activeConversationId) {
              return { ...c, messages: c.messages.map(msg => msg.id === modelMessage.id ? { ...msg, content: msg.content + chunk.text } : msg) };
            }
            return c;
        }));
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setConversations(prev => prev.map(c => {
          if (c.id === activeConversationId) {
            return { ...c, messages: c.messages.map(msg => msg.id === modelMessage.id ? { ...msg, content: 'Sorry, I encountered an error.' } : msg) };
          }
          return c;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRoomMessage = (text: string) => {
      if (!activeRoomId) return;
      
      const newMessage: RoomMessage = {
        id: Date.now().toString(),
        senderId: userId,
        text,
        timestamp: new Date().toISOString(),
        reactions: {}
      };

      setRooms(prev => prev.map(r => r.id === activeRoomId ? {...r, messages: [...r.messages, newMessage]} : r));
  };
  
  const handleAskAiInRoom = async (text: string) => {
      if (!activeRoomId) return;
      setIsLoading(true);

      const userMessage: RoomMessage = {
        id: Date.now().toString(),
        senderId: userId,
        text: `/ask ${text}`,
        timestamp: new Date().toISOString(),
        reactions: {}
      };

      setRooms(prev => prev.map(r => r.id === activeRoomId ? {...r, messages: [...r.messages, userMessage]} : r));

      try {
        const response = await askQuestion(text);
        const aiMessage: RoomMessage = {
          id: (Date.now() + 1).toString(),
          senderId: 'PixelBot',
          text: response,
          timestamp: new Date().toISOString(),
          reactions: {}
        };
        setRooms(prev => prev.map(r => r.id === activeRoomId ? {...r, messages: [...r.messages, aiMessage]} : r));
      } catch (error) {
         console.error("Error asking AI in room:", error);
         const errorMessage: RoomMessage = {
          id: (Date.now() + 1).toString(),
          senderId: 'PixelBot',
          text: "Sorry, I couldn't answer that question.",
          timestamp: new Date().toISOString(),
          reactions: {}
        };
        setRooms(prev => prev.map(r => r.id === activeRoomId ? {...r, messages: [...r.messages, errorMessage]} : r));
      } finally {
        setIsLoading(false);
      }
  };


  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeRoom = rooms.find(r => r.id === activeRoomId);

  return (
    <div className="h-screen w-screen font-sans flex overflow-hidden">
        <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[280px]' : 'w-0'}`}>
          <Sidebar
            conversations={conversations}
            rooms={rooms}
            activeConversationId={activeConversationId}
            activeRoomId={activeRoomId}
            onToggle={toggleSidebar}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onSelectRoom={handleSelectRoom}
            onOpenNotepad={handleOpenNotepad}
            onOpenRoomModal={handleOpenRoomModal}
          />
        </div>

        {!isSidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="absolute top-5 left-4 z-10 p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-md transition-colors"
            aria-label="Open sidebar"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        )}

        <main className="flex-1 flex flex-col bg-[#F9F9F9] relative">
          {activeConversation && (
            <ChatView
              key={activeConversation.id}
              conversation={activeConversation}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isSidebarOpen={isSidebarOpen}
            />
          )}
          {activeRoom && (
            <RoomView
              key={activeRoom.id}
              room={activeRoom}
              currentUserId={userId}
              onSendMessage={handleSendRoomMessage}
              onAskAi={handleAskAiInRoom}
              isLoading={isLoading}
              isSidebarOpen={isSidebarOpen}
            />
          )}
        </main>
      <NotepadModal isOpen={isNotepadOpen} onClose={handleCloseNotepad} />
      <RoomModal 
        isOpen={isRoomModalOpen} 
        onClose={handleCloseRoomModal} 
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    </div>
  );
};

export default App;
