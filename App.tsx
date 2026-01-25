
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import RoomView from './components/RoomView';
import FolderView from './components/FolderView';
import NotepadModal from './components/NotepadModal';
import RoomModal from './components/RoomModal';
import TelegramModal from './components/TelegramModal';
import StudyToolsModal from './components/StudyToolsModal';
import AddToFolderModal from './components/AddToFolderModal';
import { MenuIcon } from './components/Icons';
import { Conversation, Message, Room, RoomMessage, TelegramCredentials, Note, Folder, SavedItem } from './types';
import { startChat, sendMessageStream, askQuestion, sendTelegramMessage, LocationData } from './services/geminiService';
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
const FOLDERS_KEY_PREFIX = 'pixel-ai-folders-';
const TELEGRAM_CREDS_KEY = 'pixel-ai-telegram-creds';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [location, setLocation] = useState<LocationData | undefined>(undefined);

  // Modals
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isStudyToolsOpen, setIsStudyToolsOpen] = useState(false);
  const [isAddToFolderModalOpen, setIsAddToFolderModalOpen] = useState(false);
  
  const [pendingSaveContent, setPendingSaveContent] = useState<string | null>(null);
  const [studyToolConfig, setStudyToolConfig] = useState<{folder: Folder, type: 'quiz' | 'flashcards' | 'mindmap'} | null>(null);

  const [userId, setUserId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [telegramCredentials, setTelegramCredentials] = useState<TelegramCredentials | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // Auth & Geolocation Init
  useEffect(() => {
    const initApp = async () => {
        // Auth
        try {
            const user = await login();
            setUserId(user.uid);
        } catch (error) {
            let localId = localStorage.getItem(USER_ID_KEY);
            if (!localId) {
                localId = `user_${crypto.randomUUID().substring(0, 8)}`;
                localStorage.setItem(USER_ID_KEY, localId);
            }
            setUserId(localId);
        }

        // Geolocation
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn("Geolocation denied or unavailable:", error);
                }
            );
        }

        // Load Telegram Credentials
        const saved = localStorage.getItem(TELEGRAM_CREDS_KEY);
        if (saved) {
            try {
                setTelegramCredentials(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse telegram creds", e);
            }
        }
    };
    initApp();
  }, []);

  // Listen to Rooms
  useEffect(() => {
    if (!userId) return;
    try {
        const unsubscribe = listenToUserRooms(userId, (updatedRooms) => { setRooms(updatedRooms); });
        return () => unsubscribe();
    } catch (e) { console.error(e); }
  }, [userId]);

  useEffect(() => {
      if (!activeRoomId) { setRoomMessages([]); return; }
      setIsLoading(true);
      const unsubscribe = listenToMessages(activeRoomId, (msgs) => {
          setRoomMessages(msgs);
          setIsLoading(false);
      });
      return () => unsubscribe();
  }, [activeRoomId]);

  const handleNewChat = useCallback(() => {
    if (initializationError) return;
    setActiveRoomId(null);
    setActiveFolderId(null);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    try {
        const newConversation: Conversation = {
          id: Date.now().toString(),
          title: 'New Study Chat',
          messages: [],
          chatSession: startChat(undefined, location),
        };
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversationId(newConversation.id);
    } catch (error) {
        if (error instanceof Error) setInitializationError(error.message);
    }
  }, [initializationError, location]);

  // Load persistence
  useEffect(() => {
      if (!userId) return;
      const key = `${CONVERSATIONS_KEY_PREFIX}${userId}`;
      const folderKey = `${FOLDERS_KEY_PREFIX}${userId}`;
      
      const savedConv = localStorage.getItem(key);
      const savedFolders = localStorage.getItem(folderKey);

      if (savedFolders) {
          try { setFolders(JSON.parse(savedFolders)); } catch (e) { setFolders([]); }
      }

      try {
          if (savedConv) {
              const saved: any[] = JSON.parse(savedConv);
              if (saved.length > 0) {
                  const rehydrated = saved.map(c => ({
                      ...c,
                      chatSession: startChat(
                          c.messages.map((msg: any) => ({ role: msg.role, parts: [{ text: msg.content }] })),
                          location
                      ),
                  }));
                  setConversations(rehydrated);
                  setActiveConversationId(rehydrated[0]?.id || null);
              } else handleNewChat();
          } else handleNewChat();
      } catch (e) { handleNewChat(); }
  }, [userId, handleNewChat, location]);

  // Sync state to localstorage
  useEffect(() => {
      if (!userId) return;
      if (conversations.length > 0) {
          const toSave = conversations.map(c => ({
              id: c.id,
              title: c.title,
              messages: c.messages.map(m => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  groundingMetadata: m.groundingMetadata ? JSON.parse(JSON.stringify(m.groundingMetadata)) : undefined
              }))
          }));
          localStorage.setItem(`${CONVERSATIONS_KEY_PREFIX}${userId}`, JSON.stringify(toSave));
      }
      localStorage.setItem(`${FOLDERS_KEY_PREFIX}${userId}`, JSON.stringify(folders));
  }, [conversations, folders, userId]);

  const handleSendMessage = async (prompt: string) => {
    if (!activeConversationId) return;
    setIsLoading(true);

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: prompt };
    const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', content: '' };
    
    setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...c.messages, userMessage, modelMessage] } : c));

    try {
      const activeConvo = conversations.find(c => c.id === activeConversationId);
      if (!activeConvo) throw new Error("Chat session not found");

      const stream = await sendMessageStream(activeConvo.chatSession, prompt);
      
      for await (const chunk of stream) {
        setConversations(prev => prev.map(c => {
            if (c.id === activeConversationId) {
              const metadata = chunk.candidates?.[0]?.groundingMetadata;
              const plainMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : undefined;

              return { 
                ...c, 
                messages: c.messages.map(msg => msg.id === modelMessage.id ? {
                    ...msg, 
                    content: msg.content + chunk.text, 
                    groundingMetadata: plainMetadata || msg.groundingMetadata
                } : msg) 
              };
            }
            return c;
        }));
      }
    } catch (error) {
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.map(msg => msg.id === modelMessage.id ? { ...msg, content: 'Pixel AI encountered a temporary issue. Please try again.' } : msg) } : c));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimplify = (content: string) => {
      handleSendMessage(`Simplify this for a student: ${content.substring(0, 150)}...`);
  };

  const handleAddToFolderTrigger = (content: string) => {
      setPendingSaveContent(content);
      setIsAddToFolderModalOpen(true);
  };

  const handleSaveToFolder = (folderName: string) => {
      if (!pendingSaveContent) return;
      const activeConvo = conversations.find(c => c.id === activeConversationId);
      const sourceTitle = activeConvo?.title || "Untitled Chat";

      setFolders(prev => {
          const existing = prev.find(f => f.name.toLowerCase() === folderName.toLowerCase());
          const newItem: SavedItem = { 
              id: Date.now().toString(), 
              content: pendingSaveContent, 
              timestamp: Date.now(), 
              sourceTitle 
          };
          if (existing) {
              return prev.map(f => f.id === existing.id ? { ...f, items: [newItem, ...f.items] } : f);
          } else {
              return [...prev, { id: Date.now().toString(), name: folderName, items: [newItem] }];
          }
      });
      setPendingSaveContent(null);
  };

  const handleDeleteFolderItem = (folderId: string, itemId: string) => {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, items: f.items.filter(i => i.id !== itemId) } : f));
  };

  const handleSelectFolder = (folder: Folder) => {
      setActiveFolderId(folder.id);
      setActiveConversationId(null);
      setActiveRoomId(null);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
      setActiveConversationId(id);
      setActiveFolderId(null);
      setActiveRoomId(null);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleSelectRoom = (id: string) => {
      setActiveRoomId(id);
      setActiveConversationId(null);
      setActiveFolderId(null);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeRoomMetadata = rooms.find(r => r.id === activeRoomId);
  const activeRoom: Room | undefined = activeRoomMetadata ? { ...activeRoomMetadata, messages: roomMessages } : undefined;
  const activeFolder = folders.find(f => f.id === activeFolderId);

  if (initializationError) return <div className="flex h-screen w-screen items-center justify-center p-10 text-red-600 bg-red-50 text-center font-bold text-xl">{initializationError}</div>;

  return (
    <div className="h-screen w-screen flex overflow-hidden font-sans bg-[#F9F9F9] relative">
        {/* Mobile Overlay */}
        {isSidebarOpen && window.innerWidth < 1024 && (
            <div 
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] transition-opacity duration-300" 
                onClick={() => setIsSidebarOpen(false)}
            />
        )}

        <div className={`
            ${window.innerWidth < 1024 ? 'fixed inset-y-0 left-0 z-[100]' : 'relative'}
            transition-all duration-300 ease-in-out h-full overflow-hidden bg-white
            ${isSidebarOpen ? 'w-[280px] translate-x-0 shadow-2xl lg:shadow-none' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0'}
        `}>
          <Sidebar
            conversations={conversations}
            rooms={rooms}
            folders={folders}
            activeConversationId={activeConversationId}
            activeRoomId={activeRoomId}
            onToggle={() => setIsSidebarOpen(false)}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onSelectRoom={handleSelectRoom}
            onSelectFolder={handleSelectFolder}
            onOpenNotepad={() => setIsNotepadOpen(true)}
            onOpenRoomModal={() => setIsRoomModalOpen(true)}
            onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
            onOpenStudyTools={(f, t) => { setStudyToolConfig({ folder: f, type: t }); setIsStudyToolsOpen(true); }}
            onDeleteFolder={(id) => setFolders(prev => prev.filter(f => f.id !== id))}
          />
        </div>

        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="fixed top-5 left-5 z-[80] p-4 text-indigo-600 bg-white shadow-xl border border-indigo-50 rounded-2xl hover:scale-110 transition-all flex items-center justify-center animate-fade-in group"
            title="Open Sidebar"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
        )}

        <main className="flex-1 flex flex-col bg-white relative min-w-0 overflow-hidden">
          {activeConversation && (
            <ChatView
              key={activeConversation.id}
              conversation={activeConversation}
              onSendMessage={handleSendMessage}
              onSimplify={handleSimplify}
              onAddToFolder={handleAddToFolderTrigger}
              isLoading={isLoading}
              isSidebarOpen={isSidebarOpen}
              telegramCredentials={telegramCredentials}
              onSendTelegram={async (text, chatId) => {
                  if (!telegramCredentials?.token) return { success: false, message: 'Bot Token missing.' };
                  const ok = await sendTelegramMessage(telegramCredentials.token, chatId, text);
                  return { success: ok, message: ok ? 'Sent!' : 'Failed.' };
              }}
            />
          )}
          {activeRoom && (
            <RoomView
              key={activeRoom.id}
              room={activeRoom}
              currentUserId={userId}
              onSendMessage={async (text) => await sendFirebaseRoomMessage(activeRoom.id, { senderId: userId, text })}
              onAskAi={async (text) => {
                  await sendFirebaseRoomMessage(activeRoom.id, { senderId: userId, text: `/ask ${text}` });
                  const { text: res, groundingMetadata } = await askQuestion(text, location);
                  await sendFirebaseRoomMessage(activeRoom.id, { senderId: 'PixelBot', text: res, groundingMetadata });
              }}
              onToggleReaction={async (mid, emoji) => await toggleFirebaseReaction(activeRoom.id, mid, emoji, userId)}
              isLoading={isLoading}
              isSidebarOpen={isSidebarOpen}
            />
          )}
          {activeFolder && (
            <FolderView 
                folder={activeFolder} 
                onClose={() => setActiveFolderId(null)} 
                onDeleteItem={(itemId) => handleDeleteFolderItem(activeFolder.id, itemId)}
            />
          )}
          {!activeConversation && !activeRoom && !activeFolder && (
              <div className="flex flex-col items-center justify-center h-full text-center px-10">
                  <img src="https://iili.io/K4QGIa9.png" alt="Pixel AI" className="w-24 h-24 mb-6 animate-pulse" />
                  <h2 className="text-3xl font-black text-indigo-900 mb-2">Welcome to Pixel AI</h2>
                  <p className="text-gray-500 max-w-sm mb-8">Your personal pedagogical assistant. Start a chat or open a study folder to begin.</p>
                  <button onClick={handleNewChat} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Start Studying</button>
              </div>
          )}
        </main>

      <NotepadModal isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} notes={notes} onUpdateNotes={setNotes} />
      <RoomModal isOpen={isRoomModalOpen} onClose={() => setIsRoomModalOpen(false)} onCreateRoom={async (code) => await createRoom(userId, code)} onJoinRoom={async (code) => await joinRoom(code, userId)} />
      <TelegramModal isOpen={isTelegramModalOpen} onClose={() => setIsTelegramModalOpen(false)} onSave={(t, r) => { 
          const creds = { token: t, recipients: r };
          setTelegramCredentials(creds); 
          localStorage.setItem(TELEGRAM_CREDS_KEY, JSON.stringify(creds)); 
      }} initialToken={telegramCredentials?.token} initialRecipients={telegramCredentials?.recipients} />
      
      {studyToolConfig && (
        <StudyToolsModal 
            isOpen={isStudyToolsOpen} 
            onClose={() => setIsStudyToolsOpen(false)} 
            folder={studyToolConfig.folder} 
            type={studyToolConfig.type} 
            telegramCredentials={telegramCredentials}
            onSendTelegram={async (text, chatId) => {
                if (!telegramCredentials?.token) return { success: false, message: 'Bot Token missing.' };
                const ok = await sendTelegramMessage(telegramCredentials.token, chatId, text);
                return { success: ok, message: ok ? 'Sent!' : 'Failed.' };
            }}
            currentUserId={userId}
        />
      )}

      <AddToFolderModal 
        isOpen={isAddToFolderModalOpen}
        onClose={() => setIsAddToFolderModalOpen(false)}
        folders={folders}
        onConfirm={handleSaveToFolder}
      />
    </div>
  );
};

export default App;
