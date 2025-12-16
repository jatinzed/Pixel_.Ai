import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import RoomView from './components/RoomView';
import NotepadModal from './components/NotepadModal';
import RoomModal from './components/RoomModal';
import TelegramModal from './components/TelegramModal';
import { MenuIcon } from './components/Icons';
import { Conversation, Message, Room, RoomMessage, TelegramCredentials, TelegramRecipient, Note } from './types';
import { startChat, sendMessageStream, askQuestion, sendTelegramMessage } from './services/geminiService';
import { 
    login, 
    createRoom, 
    joinRoom, 
    listenToUserRooms, 
    listenToMessages,
    sendRoomMessage as sendFirebaseRoomMessage, 
    toggleReaction as toggleFirebaseReaction
} from './services/firebaseService';


const USER_ID_KEY = 'pixel-ai-user-id';
const CONVERSATIONS_KEY_PREFIX = 'pixel-ai-conversations-';
const NOTEPAD_KEY_PREFIX = 'pixel-ai-notepad-';
const TELEGRAM_CREDS_KEY = 'pixel-ai-telegram-creds';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  // Rooms state (Metadata only)
  const [rooms, setRooms] = useState<Room[]>([]);
  // Active Room Messages (Real-time data)
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  
  const [userId, setUserId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  
  const [telegramCredentials, setTelegramCredentials] = useState<TelegramCredentials | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // 1. Initialize Firebase Auth
  useEffect(() => {
    const initAuth = async () => {
        try {
            const user = await login();
            console.log("Logged in to Firebase as:", user.uid);
            setUserId(user.uid);
            // We use the Firebase UID as the user ID for consistency
        } catch (error) {
            console.error("Firebase Auth failed", error);
            // Fallback to local ID if firebase fails entirely
            let localId = localStorage.getItem(USER_ID_KEY);
            if (!localId) {
                localId = `user_${crypto.randomUUID().substring(0, 8)}`;
                localStorage.setItem(USER_ID_KEY, localId);
            }
            setUserId(localId);
        }
    };
    initAuth();
  }, []);

  // 2. Listen to User's Rooms (Sidebar List)
  useEffect(() => {
    if (!userId) return;
    try {
        const unsubscribe = listenToUserRooms(userId, (updatedRooms) => {
            setRooms(updatedRooms);
        });
        return () => unsubscribe();
    } catch (e) {
        console.error("Firebase room listener failed", e);
    }
  }, [userId]);

  // 3. Listen to Active Room Messages (Subcollection)
  useEffect(() => {
      if (!activeRoomId) {
          setRoomMessages([]);
          return;
      }
      setIsLoading(true); // Show loader while fetching
      const unsubscribe = listenToMessages(activeRoomId, (msgs) => {
          setRoomMessages(msgs);
          setIsLoading(false);
      });
      return () => unsubscribe();
  }, [activeRoomId]);

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

  // Load conversations
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
             localStorage.removeItem(key); 
             handleNewChat(); 
          }
      }
  }, [userId, handleNewChat]);

  // Save conversations
  useEffect(() => {
      if (!userId || conversations.length === 0) return;
      const toSave = conversations.filter(c => c.messages.length > 0).map(({ chatSession, ...rest }) => rest);
      if (toSave.length > 0) {
          localStorage.setItem(`${CONVERSATIONS_KEY_PREFIX}${userId}`, JSON.stringify(toSave));
      } else {
          localStorage.removeItem(`${CONVERSATIONS_KEY_PREFIX}${userId}`);
      }
  }, [conversations, userId]);
  
  // Load/Save Notes
  useEffect(() => {
    if (!userId) return;
    const key = `${NOTEPAD_KEY_PREFIX}${userId}`;
    const savedContent = localStorage.getItem(key);
    if (savedContent) {
        try {
            const parsed = JSON.parse(savedContent);
            if (Array.isArray(parsed)) setNotes(parsed);
        } catch (e) {
            if (savedContent.trim().length > 0) {
                setNotes([{ id: Date.now().toString(), title: 'My Notes', content: savedContent, updatedAt: Date.now() }]);
            }
        }
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(`${NOTEPAD_KEY_PREFIX}${userId}`, JSON.stringify(notes));
  }, [notes, userId]);
  
  // Load Telegram Creds
  useEffect(() => {
    const savedCreds = localStorage.getItem(TELEGRAM_CREDS_KEY);
    if (savedCreds) {
        try { setTelegramCredentials(JSON.parse(savedCreds)); } catch (e) {}
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
            return {success: false, message: 'Telegram Bot Token not configured.'};
        }
        const success = await sendTelegramMessage(telegramCredentials.token, chatId, text);
        return success 
            ? {success: true, message: 'Message sent.'} 
            : {success: false, message: 'Failed to send.'};
    }, [telegramCredentials]);

  const handleSelectConversation = (id: string) => {
    setActiveRoomId(null);
    setActiveConversationId(id);
  };
  
  const handleSelectRoom = (id: string) => {
    setActiveConversationId(null);
    setActiveRoomId(id);
  };

  const handleCreateRoom = async (customCode?: string): Promise<string> => {
    const roomCode = await createRoom(userId, customCode);
    handleSelectRoom(roomCode);
    return roomCode;
  };
  
  const handleJoinRoom = async (roomCode: string) => {
    await joinRoom(roomCode, userId);
    handleSelectRoom(roomCode);
  };

  const handleSendMessage = async (prompt: string) => {
    if (!activeConversationId) return;
    setIsLoading(true);

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: prompt };
    const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', content: '' };
    
    setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...c.messages, userMessage, modelMessage] } : c));

    try {
      const chatSession = conversations.find(c => c.id === activeConversationId)?.chatSession;
      if (!chatSession) throw new Error("Chat session not found");

      const stream = await sendMessageStream(chatSession, prompt);
      
      for await (const chunk of stream) {
        setConversations(prev => prev.map(c => {
            if (c.id === activeConversationId) {
              return { 
                ...c, 
                messages: c.messages.map(msg => msg.id === modelMessage.id ? {...msg, content: msg.content + chunk.text, groundingMetadata: chunk.candidates?.[0]?.groundingMetadata || msg.groundingMetadata} : msg) 
              };
            }
            return c;
        }));
      }
    } catch (error) {
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.map(msg => msg.id === modelMessage.id ? { ...msg, content: 'Sorry, I encountered an error.' } : msg) } : c));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRoomMessage = async (text: string) => {
      if (!activeRoomId) return;
      await sendFirebaseRoomMessage(activeRoomId, { senderId: userId, text });
  };
  
  const handleAskAiInRoom = async (text: string) => {
      if (!activeRoomId) return;
      // Optimistic update handled by listener, but we show loading
      await sendFirebaseRoomMessage(activeRoomId, { senderId: userId, text: `/ask ${text}` });

      try {
        const { text: responseText, groundingMetadata } = await askQuestion(text);
        await sendFirebaseRoomMessage(activeRoomId, {
            senderId: 'PixelBot',
            text: responseText,
            groundingMetadata: groundingMetadata
        });
      } catch (error) {
         await sendFirebaseRoomMessage(activeRoomId, { senderId: 'PixelBot', text: "Sorry, I couldn't answer that question." });
      }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!activeRoomId) return;
    await toggleFirebaseReaction(activeRoomId, messageId, emoji, userId);
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  // Construct the active room object by combining metadata + real-time messages
  const activeRoomMetadata = rooms.find(r => r.id === activeRoomId);
  const activeRoom: Room | undefined = activeRoomMetadata ? { ...activeRoomMetadata, messages: roomMessages } : undefined;

  if (initializationError) return <div className="flex h-screen w-screen items-center justify-center p-10 text-red-600 bg-red-50 text-center font-bold text-xl">{initializationError}</div>;

  return (
    <div className="h-screen w-screen flex overflow-hidden">
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
          <button onClick={toggleSidebar} className="absolute top-5 left-4 z-10 p-1.5 text-gray-500 hover:bg-gray-100 rounded-md">
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
          {activeRoomId && !activeRoom && (
             <div className="flex items-center justify-center h-full text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-2"></div>
                <span>Syncing Room...</span>
             </div>
          )}
        </main>
      <NotepadModal isOpen={isNotepadOpen} onClose={handleCloseNotepad} notes={notes} onUpdateNotes={setNotes} />
      <RoomModal isOpen={isRoomModalOpen} onClose={handleCloseRoomModal} onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      <TelegramModal isOpen={isTelegramModalOpen} onClose={handleCloseTelegramModal} onSave={handleSaveTelegramCredentials} initialToken={telegramCredentials?.token} initialRecipients={telegramCredentials?.recipients} />
    </div>
  );
};

export default App;