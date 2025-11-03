import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import RoomView from './components/RoomView';
import NotepadModal from './components/NotepadModal';
import RoomModal from './components/RoomModal';
import TelegramModal from './components/TelegramModal';
import { MenuIcon } from './components/Icons';
import { Conversation, Message, Room, TelegramCredentials, TelegramRecipient } from './types';
import { startChat, sendMessageStream, askQuestion, sendTelegramMessage } from './services/geminiService';
import { createRoom, joinRoom, listenToUserRooms, sendRoomMessage as sendFirebaseRoomMessage, toggleReaction as toggleFirebaseReaction } from './services/firebaseService';


const USER_ID_KEY = 'pixel-ai-user-id';
const CONVERSATIONS_KEY_PREFIX = 'pixel-ai-conversations-';
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
  
  // Set up real-time listener for chat rooms from Firebase
  useEffect(() => {
    if (!userId) return;
    
    const unsubscribe = listenToUserRooms(userId, (updatedRooms) => {
        setRooms(updatedRooms);
    });

    return () => {
        unsubscribe();
    };
  }, [userId]);
  
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

  const handleCreateRoom = async (): Promise<string> => {
    const roomCode = await createRoom(userId);
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

  const handleSendRoomMessage = async (text: string) => {
      if (!activeRoomId) return;
      await sendFirebaseRoomMessage(activeRoomId, { senderId: userId, text });
  };
  
  const handleAskAiInRoom = async (text: string) => {
      if (!activeRoomId) return;
      setIsLoading(true);

      await sendFirebaseRoomMessage(activeRoomId, { senderId: userId, text: `/ask ${text}` });

      try {
        const { text: responseText, groundingMetadata } = await askQuestion(text);
        await sendFirebaseRoomMessage(activeRoomId, {
            senderId: 'PixelBot',
            text: responseText,
            groundingMetadata: groundingMetadata
        });
      } catch (error) {
         console.error("Error asking AI in room:", error);
         if (error instanceof Error && error.message.includes("API key")) {
            setInitializationError(error.message);
            return;
         }
         await sendFirebaseRoomMessage(activeRoomId, {
            senderId: 'PixelBot',
            text: "Sorry, I couldn't answer that question.",
         });
      } finally {
        setIsLoading(false);
      }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!activeRoomId) return;
    await toggleFirebaseReaction(activeRoomId, messageId, emoji, userId);
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