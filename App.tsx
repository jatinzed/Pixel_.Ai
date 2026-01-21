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

  // Auth Init
  useEffect(() => {
    const initAuth = async () => {
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
    };
    initAuth();
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
    try {
        const newConversation: Conversation = {
          id: Date.now().toString(),
          title: 'New Study Chat',
          messages: [],
          chatSession: startChat(),
        };
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversationId(newConversation.id);
    } catch (error) {
        if (error instanceof Error) setInitializationError(error.message);
    }
  }, [initializationError]);

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
              const saved: Omit<Conversation, 'chatSession'>[] = JSON.parse(savedConv);
              if (saved.length > 0) {
                  const rehydrated = saved.map(c => ({
                      ...c,
                      chatSession: startChat(c.messages.map(msg => ({ role: msg.role, parts: [{ text: msg.content }] }))),
                  }));
                  setConversations(rehydrated);
                  setActiveConversationId(rehydrated[0]?.id || null);
              } else handleNewChat();
          } else handleNewChat();
      } catch (e) { handleNewChat(); }
  }, [userId, handleNewChat]);

  // Sync state to localstorage
  useEffect(() => {
      if (!userId) return;
      if (conversations.length > 0) {
          const toSave = conversations.map(c => {
              const { chatSession, ...rest } = c;
              return rest;
          });
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
              return { 
                ...c, 
                messages: c.messages.map(msg => msg.id === modelMessage.id ? {...msg, content: msg.content + chunk.text, groundingMetadata: chunk.candidates?.[0]?.groundingMetadata || msg.groundingMetadata} : msg) 
              };
            }
            return c;
        }));
      }
    } catch (error) {
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.map(msg => msg.id === modelMessage.id ? { ...msg, content: 'Encountered a problem. Please check your connection.' } : msg) } : c));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimplify = (content: string) => {
      handleSendMessage(`Can you explain this again, but the 'Easy Way'? Keep it simple for a student. Reference: ${content.substring(0, 100)}...`);
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
  };

  const handleSelectConversation = (id: string) => {
      setActiveConversationId(id);
      setActiveFolderId(null);
      setActiveRoomId(null);
  };

  const handleSelectRoom = (id: string) => {
      setActiveRoomId(id);
      setActiveConversationId(null);
      setActiveFolderId(null);
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeRoomMetadata = rooms.find(r => r.id === activeRoomId);
  const activeRoom: Room | undefined = activeRoomMetadata ? { ...activeRoomMetadata, messages: roomMessages } : undefined;
  const activeFolder = folders.find(f => f.id === activeFolderId);

  if (initializationError) return <div className="flex h-screen w-screen items-center justify-center p-10 text-red-600 bg-red-50 text-center font-bold text-xl">{initializationError}</div>;

  return (
    <div className="h-screen w-screen flex overflow-hidden font-sans bg-[#F9F9F9]">
        <div className={`transition-all duration-300 ease-in-out h-full overflow-hidden ${isSidebarOpen ? 'w-[280px]' : 'w-0'}`}>
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
            className="fixed top-5 left-5 z-[100] p-4 text-indigo-600 bg-white/80 backdrop-blur-md shadow-2xl border border-indigo-50 rounded-2xl hover:bg-white hover:scale-110 transition-all flex items-center justify-center animate-fade-in group"
            title="Open Study Sidebar"
          >
            <MenuIcon className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        )}

        <main className="flex-1 flex flex-col bg-white relative">
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
                  const { text: res, groundingMetadata } = await askQuestion(text);
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
        </main>

      <NotepadModal isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} notes={notes} onUpdateNotes={setNotes} />
      <RoomModal isOpen={isRoomModalOpen} onClose={() => setIsRoomModalOpen(false)} onCreateRoom={async (code) => await createRoom(userId, code)} onJoinRoom={async (code) => await joinRoom(code, userId)} />
      <TelegramModal isOpen={isTelegramModalOpen} onClose={() => setIsTelegramModalOpen(false)} onSave={(t, r) => { setTelegramCredentials({ token: t, recipients: r }); localStorage.setItem(TELEGRAM_CREDS_KEY, JSON.stringify({ token: t, recipients: r })); }} initialToken={telegramCredentials?.token} initialRecipients={telegramCredentials?.recipients} />
      
      {studyToolConfig && (
        <StudyToolsModal 
            isOpen={isStudyToolsOpen} 
            onClose={() => setIsStudyToolsOpen(false)} 
            folder={studyToolConfig.folder} 
            type={studyToolConfig.type} 
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