
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import RoomView from './components/RoomView';
import NotepadModal from './components/NotepadModal';
import RoomModal from './components/RoomModal';
import TelegramModal from './components/TelegramModal';
import { MenuIcon } from './components/Icons';
import { Conversation, Message, Room, RoomMessage, TelegramCredentials, TelegramRecipient } from './types';
import { startChat, sendMessageStream, askQuestion, sendTelegramMessage } from './services/geminiService';

const USER_ID_KEY = 'pixel-ai-user-id';
const CONVERSATIONS_KEY_PREFIX = 'pixel-ai-conversations-';
const ROOMS_KEY = 'pixel-ai-rooms';
const NOTEPAD_KEY_PREFIX = 'pixel-ai-notepad-';
const TELEGRAM_CREDS_KEY = 'pixel-ai-telegram-creds';

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
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [notepadContent, setNotepadContent] = useState('');
  const [telegramCredentials, setTelegramCredentials] = useState<TelegramCredentials | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  const handleNewChat = useCallback(() => {
    if (initializationError) return;
    setIsLoading(false);
    setActiveRoomId(null);
    try {
        const newConversation: Conversation = {
          id: Date.now().toString(),
          title: 'New Chat',
          messages: [],
          chatSession: startChat(),
        };
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversationId(newConversation.id);
    } catch (error) {
        console.error("Initialization Error on new chat:", error);
        if (error instanceof Error) setInitializationError(error.message);
    }
  }, [initializationError]);

  // Load conversations from local storage
  useEffect(() => {
      if (!userId) return;
      const key = `${CONVERSATIONS_KEY_PREFIX}${userId}`;
      const saved = localStorage.getItem(key);
      
      try {
          if (saved) {
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
          } else { handleNewChat(); }
      } catch (e) { 
          if (e instanceof Error && e.message.includes("API key")) {
            setInitializationError(e.message);
          } else {
            console.error("Failed to load conversations:", e); 
            localStorage.removeItem(key); 
            handleNewChat(); 
          }
      }
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
  
  // Load Notepad Content
  useEffect(() => {
    if (!userId) return;
    const key = `${NOTEPAD_KEY_PREFIX}${userId}`;
    const savedContent = localStorage.getItem(key);
    if (savedContent) {
      setNotepadContent(savedContent);
    }
  }, [userId]);

  // Save Notepad Content
  useEffect(() => {
    if (!userId) return;
    const key = `${NOTEPAD_KEY_PREFIX}${userId}`;
    localStorage.setItem(key, notepadContent);
  }, [notepadContent, userId]);

  // Load rooms from local storage & set up real-time sync
  useEffect(() => {
    const saved = localStorage.getItem(ROOMS_KEY);
    if (saved) {
      try {
        const savedRooms: Room[] = JSON.parse(saved);
        setRooms(savedRooms);
      } catch (e) { console.error("Failed to load rooms:", e); localStorage.removeItem(ROOMS_KEY); }
    }
    
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === ROOMS_KEY && event.newValue) {
            try {
                const updatedRooms: Room[] = JSON.parse(event.newValue);
                setRooms(updatedRooms);
            } catch (e) {
                console.error("Failed to update rooms from storage event:", e);
            }
        }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Save rooms to local storage (and broadcast to other tabs)
  useEffect(() => {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  }, [rooms]);
  
    // Load Telegram credentials from local storage
  useEffect(() => {
    const savedCreds = localStorage.getItem(TELEGRAM_CREDS_KEY);
    if (savedCreds) {
        try {
            setTelegramCredentials(JSON.parse(savedCreds));
        } catch (e) { console.error("Failed to parse Telegram credentials", e); }
    }
  }, []);


  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const handleOpenNotepad = () => setIsNotepadOpen(true);
  const handleCloseNotepad = () => setIsNotepadOpen(false);
  const handleOpenRoomModal = () => setIsRoomModalOpen(true);
  const handleCloseRoomModal = () => setIsRoomModalOpen(false);
  const handleOpenTelegramModal = () => setIsTelegramModalOpen(true);
  const handleCloseTelegramModal = () => setIsTelegramModalOpen(false);
  
  const handleSaveTelegramCredentials = (token: string, recipients: TelegramRecipient[]) => {
      const creds = { token, recipients };
      setTelegramCredentials(creds);
      localStorage.setItem(TELEGRAM_CREDS_KEY, JSON.stringify(creds));
  };
  
  const sendTelegram = useCallback(async (text: string, chatId: string): Promise<{success: boolean, message: string}> => {
        if (!telegramCredentials?.token) {
            handleOpenTelegramModal();
            return {success: false, message: 'Telegram Bot Token is not configured. Please configure it.'};
        }
        const success = await sendTelegramMessage(telegramCredentials.token, chatId, text);
        if (success) {
            return {success: true, message: 'Message sent successfully to Telegram.'};
        } else {
            return {success: false, message: 'Failed to send message to Telegram.'};
        }
    }, [telegramCredentials]);

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
    const room = rooms.find(r => r.id === roomCode);

    if (room) { // Room exists, join it
      // Defensive check for corrupted room data from localStorage
      const safeMembers = Array.isArray(room.members) ? room.members : [];
      const safeMessages = Array.isArray(room.messages) ? room.messages : [];
      
      const isMember = safeMembers.some(m => m.id === userId);
      if (!isMember) {
        const updatedRoom: Room = {
          ...room,
          members: [...safeMembers, { id: userId, status: 'online' }],
          messages: [
            ...safeMessages,
            {
              id: Date.now().toString(),
              senderId: 'PixelBot',
              text: `User ${userId.substring(5)} has joined the room.`,
              timestamp: new Date().toISOString(),
              reactions: {},
            },
          ],
        };
        setRooms(prev => prev.map(r => (r.id === roomCode ? updatedRoom : r)));
      }
      handleSelectRoom(roomCode);
    } else { // Room doesn't exist, create it
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
      handleSelectRoom(roomCode);
    }
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
              return { 
                ...c, 
                messages: c.messages.map(msg => {
                  if (msg.id === modelMessage.id) {
                    const newMsg = {...msg, content: msg.content + chunk.text};
                    if (chunk.candidates?.[0]?.groundingMetadata) {
                        newMsg.groundingMetadata = chunk.candidates[0].groundingMetadata;
                    }
                    return newMsg;
                  }
                  return msg;
                }) 
              };
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
        const { text: responseText, groundingMetadata } = await askQuestion(text);
        const aiMessage: RoomMessage = {
          id: (Date.now() + 1).toString(),
          senderId: 'PixelBot',
          text: responseText,
          timestamp: new Date().toISOString(),
          reactions: {},
          groundingMetadata: groundingMetadata
        };
        setRooms(prev => prev.map(r => r.id === activeRoomId ? {...r, messages: [...r.messages, aiMessage]} : r));
      } catch (error) {
         console.error("Error asking AI in room:", error);
         if (error instanceof Error && error.message.includes("API key")) {
            setInitializationError(error.message);
            return;
         }
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

  const handleToggleReaction = (messageId: string, emoji: string) => {
    if (!activeRoomId) return;

    setRooms(prevRooms => prevRooms.map(room => {
        if (room.id === activeRoomId) {
            const updatedMessages = room.messages.map(message => {
                if (message.id === messageId) {
                    const reactions = { ...(message.reactions || {}) };
                    const reactingUsers = reactions[emoji] || [];
                    
                    if (reactingUsers.includes(userId)) {
                        reactions[emoji] = reactingUsers.filter(id => id !== userId);
                        if (reactions[emoji].length === 0) {
                            delete reactions[emoji];
                        }
                    } else {
                        reactions[emoji] = [...reactingUsers, userId];
                    }
                    return { ...message, reactions };
                }
                return message;
            });
            return { ...room, messages: updatedMessages };
        }
        return room;
    }));
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeRoom = rooms.find(r => r.id === activeRoomId);

  if (initializationError) {
      return (
          <div className="flex items-center justify-center h-screen w-screen bg-red-50 text-red-800 font-sans">
              <div className="text-center p-8 bg-white shadow-2xl rounded-lg max-w-md mx-4">
                  <h1 className="text-2xl font-bold mb-4">Application Configuration Error</h1>
                  <p className="text-gray-700">{initializationError}</p>
                  <p className="mt-4 text-sm text-gray-500">
                      This application requires a valid Gemini API key to function. Please ensure the
                      <code>API_KEY</code> environment variable is set correctly in your deployment configuration and redeploy the application.
                  </p>
              </div>
          </div>
      );
  }

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
            onOpenTelegramModal={handleOpenTelegramModal}
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
              telegramCredentials={telegramCredentials}
              onSendTelegram={sendTelegram}
            />
          )}
          {activeRoom && (
            <RoomView
              key={activeRoom.id}
              room={activeRoom}
              currentUserId={userId}
              onSendMessage={handleSendRoomMessage}
              onAskAi={handleAskAiInRoom}
              onToggleReaction={handleToggleReaction}
              isLoading={isLoading}
              isSidebarOpen={isSidebarOpen}
            />
          )}
        </main>
      <NotepadModal 
        isOpen={isNotepadOpen} 
        onClose={handleCloseNotepad} 
        content={notepadContent}
        onContentChange={setNotepadContent}
      />
      <RoomModal 
        isOpen={isRoomModalOpen} 
        onClose={handleCloseRoomModal} 
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
      <TelegramModal 
        isOpen={isTelegramModalOpen}
        onClose={handleCloseTelegramModal}
        onSave={handleSaveTelegramCredentials}
        initialToken={telegramCredentials?.token}
        initialRecipients={telegramCredentials?.recipients}
      />
    </div>
  );
};

export default App;
