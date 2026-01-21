import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import RoomView from './components/RoomView';
import NotepadModal from './components/NotepadModal';
import RoomModal from './components/RoomModal';
import TelegramModal from './components/TelegramModal';
import TopicSelectorModal from './components/TopicSelectorModal';
import StudyToolModal from './components/StudyToolModal';
import { MenuIcon } from './components/Icons';
import { Conversation, Message, Room, RoomMessage, TelegramCredentials, TelegramRecipient, Note, TopicFolder, SavedSnippet } from './types';
import { startChat, sendMessageStream, askQuestion, sendTelegramMessage, generateFlashcards, generateQuiz, generateMindMap } from './services/geminiService';
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
const FOLDERS_KEY_PREFIX = 'pixel-ai-folders-';
const TELEGRAM_CREDS_KEY = 'pixel-ai-telegram-creds';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isTopicSelectorOpen, setIsTopicSelectorOpen] = useState(false);
  const [contentToSave, setContentToSave] = useState<string | null>(null);
  const [studyToolState, setStudyToolState] = useState<{ type: 'flashcards' | 'quiz', data: any[], folderName: string } | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<TopicFolder[]>([]);
  const [telegramCredentials, setTelegramCredentials] = useState<TelegramCredentials | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!userId) return;
    try {
        const unsubscribe = listenToUserRooms(userId, (updatedRooms) => {
            setRooms(updatedRooms);
        });
        return () => unsubscribe();
    } catch (e) {}
  }, [userId]);

  useEffect(() => {
      if (!activeRoomId) {
          setRoomMessages([]);
          return;
      }
      setIsLoading(true);
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
        if (error instanceof Error) setInitializationError(error.message);
    }
  }, [initializationError]);

  useEffect(() => {
      if (!userId) return;
      const convosKey = `${CONVERSATIONS_KEY_PREFIX}${userId}`;
      const savedConvos = localStorage.getItem(convosKey);
      if (savedConvos) {
          try {
              const parsed: Omit<Conversation, 'chatSession'>[] = JSON.parse(savedConvos);
              const rehydrated = parsed.map(c => ({
                  ...c,
                  chatSession: startChat(c.messages.map(msg => ({
                      role: msg.role,
                      parts: [{ text: msg.content }],
                  }))),
              }));
              setConversations(rehydrated);
              setActiveConversationId(rehydrated[0]?.id || null);
          } catch (e) { handleNewChat(); }
      } else { handleNewChat(); }
      const foldersKey = `${FOLDERS_KEY_PREFIX}${userId}`;
      const savedFolders = localStorage.getItem(foldersKey);
      if (savedFolders) {
          try { setFolders(JSON.parse(savedFolders)); } catch (e) {}
      }
      const savedTelegram = localStorage.getItem(TELEGRAM_CREDS_KEY);
      if (savedTelegram) {
          try { setTelegramCredentials(JSON.parse(savedTelegram)); } catch (e) {}
      }
  }, [userId, handleNewChat]);

  useEffect(() => {
      if (!userId) return;
      const toSaveConvos = conversations.filter(c => c.messages.length > 0).map(({ chatSession, ...rest }) => rest);
      localStorage.setItem(`${CONVERSATIONS_KEY_PREFIX}${userId}`, JSON.stringify(toSaveConvos));
      localStorage.setItem(`${FOLDERS_KEY_PREFIX}${userId}`, JSON.stringify(folders));
  }, [conversations, folders, userId]);

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
      let fullContent = "";
      
      for await (const chunk of stream) {
        let chunkText = "";
        try {
            // chunk.text is a getter that might throw if blocked
            chunkText = chunk.text || "";
        } catch (e) {
            console.warn("Chunk blocked by safety filters", e);
            chunkText = "\n\n*(Note: Some parts of this response were withheld by safety filters)*";
        }
        
        fullContent += chunkText;
        
        setConversations(prev => prev.map(c => {
            if (c.id === activeConversationId) {
              return { 
                ...c, 
                messages: c.messages.map(msg => msg.id === modelMessage.id ? {
                    ...msg, 
                    content: fullContent, 
                    groundingMetadata: chunk.candidates?.[0]?.groundingMetadata || msg.groundingMetadata
                } : msg) 
              };
            }
            return c;
        }));
      }
    } catch (error: any) {
      console.error("Chat Stream Error:", error);
      const errorMessage = error.message?.includes("blocked") 
        ? "Pixel AI: I'm sorry, I cannot fulfill this request as it triggers my safety guidelines." 
        : "Pixel AI: I encountered a technical error. Please check your internet connection or API key configuration.";
        
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { 
          ...c, 
          messages: c.messages.map(msg => msg.id === modelMessage.id ? { ...msg, content: errorMessage } : msg) 
      } : c));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplainWithAnalogy = (content: string) => {
      const prompt = `I don't quite understand this concept yet. Explain this using a relatable analogy and concrete examples. Content: \n\n${content}`;
      handleSendMessage(prompt);
  };

  const handleStartSaveToTopic = (content: string) => {
      setContentToSave(content);
      setIsTopicSelectorOpen(true);
  };

  const onSaveToTopic = (folderId: string) => {
      if (!contentToSave) return;
      const snippet: SavedSnippet = { id: Date.now().toString(), content: contentToSave, timestamp: Date.now() };
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, snippets: [snippet, ...f.snippets], updatedAt: Date.now() } : f));
      setIsTopicSelectorOpen(false);
      setContentToSave(null);
  };

  const onCreateAndSave = (name: string) => {
      if (!contentToSave) return;
      const newFolder: TopicFolder = {
          id: Date.now().toString(),
          name,
          snippets: [{ id: Date.now().toString(), content: contentToSave, timestamp: Date.now() }],
          updatedAt: Date.now()
      };
      setFolders(prev => [newFolder, ...prev]);
      setIsTopicSelectorOpen(false);
      setContentToSave(null);
  };

  const onGenerateFlashcardsAction = async (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder || folder.snippets.length === 0) return;
      setIsGenerating(true);
      try {
          const cards = await generateFlashcards(folder.snippets.map(s => s.content));
          setStudyToolState({ type: 'flashcards', data: cards, folderName: folder.name });
      } catch (e) {
          console.error("Flashcard Gen Error", e);
      } finally { setIsGenerating(false); }
  };

  const onGenerateQuizAction = async (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder || folder.snippets.length === 0) return;
      setIsGenerating(true);
      try {
          const quiz = await generateQuiz(folder.snippets.map(s => s.content));
          setStudyToolState({ type: 'quiz', data: quiz, folderName: folder.name });
      } catch (e) {
          console.error("Quiz Gen Error", e);
      } finally { setIsGenerating(false); }
  };

  const onGenerateMindMapAction = async (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder || folder.snippets.length === 0) return;
      setIsGenerating(true);
      try {
          const mindMapText = await generateMindMap(folder.snippets.map(s => s.content));
          if (!activeConversationId) handleNewChat();
          const convoId = activeConversationId || conversations[0]?.id;
          if (convoId) {
             const userMessage: Message = { id: Date.now().toString(), role: 'user', content: `Mind Map for: ${folder.name}` };
             const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', content: mindMapText };
             setConversations(prev => prev.map(c => c.id === convoId ? { ...c, messages: [...c.messages, userMessage, modelMessage] } : c));
          }
      } catch (e) {
          console.error("Mind Map Gen Error", e);
      } finally { setIsGenerating(false); }
  };

  const handleSendRoomMessage = async (text: string) => {
      if (!activeRoomId) return;
      await sendFirebaseRoomMessage(activeRoomId, { senderId: userId, text });
  };
  
  const handleAskAiInRoom = async (text: string) => {
      if (!activeRoomId) return;
      await sendFirebaseRoomMessage(activeRoomId, { senderId: userId, text: `/ask ${text}` });
      try {
        const { text: responseText, groundingMetadata } = await askQuestion(text);
        await sendFirebaseRoomMessage(activeRoomId, { senderId: 'PixelBot', text: responseText, groundingMetadata: groundingMetadata });
      } catch (error: any) {
         await sendFirebaseRoomMessage(activeRoomId, { senderId: 'PixelBot', text: "Pixel AI: I couldn't process that question right now." });
      }
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeRoomMetadata = rooms.find(r => r.id === activeRoomId);
  const activeRoom: Room | undefined = activeRoomMetadata ? { ...activeRoomMetadata, messages: roomMessages } : undefined;

  if (initializationError) return <div className="flex h-screen w-screen items-center justify-center p-10 text-red-600 bg-red-50 text-center font-bold text-xl">{initializationError}</div>;

  return (
    <div className="h-screen w-screen flex overflow-hidden relative">
        <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[280px]' : 'w-0'}`}>
          <Sidebar
            conversations={conversations}
            rooms={rooms}
            folders={folders}
            activeConversationId={activeConversationId}
            activeRoomId={activeRoomId}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onSelectRoom={handleSelectRoom}
            onOpenNotepad={() => setIsNotepadOpen(true)}
            onOpenRoomModal={() => setIsRoomModalOpen(true)}
            onOpenTelegramModal={() => setIsTelegramModalOpen(false)}
            onGenerateFlashcards={onGenerateFlashcardsAction}
            onGenerateQuiz={onGenerateQuizAction}
            onGenerateMindMap={onGenerateMindMapAction}
          />
        </div>
        {!isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(true)} className="absolute top-5 left-4 z-10 p-1.5 text-gray-500 hover:bg-gray-100 rounded-md">
            <MenuIcon className="w-5 h-5" />
          </button>
        )}
        <main className="flex-1 flex flex-col bg-[#F9F9F9] relative">
          {activeConversation && (
            <ChatView
              key={activeConversation.id}
              conversation={activeConversation}
              onSendMessage={handleSendMessage}
              onExplainAnalogy={handleExplainWithAnalogy}
              onSaveToTopic={handleStartSaveToTopic}
              isLoading={isLoading}
              isSidebarOpen={isSidebarOpen}
              telegramCredentials={telegramCredentials}
              onSendTelegram={sendTelegramMessage}
            />
          )}
          {activeRoom && (
            <RoomView
              key={activeRoom.id}
              room={activeRoom}
              currentUserId={userId}
              onSendMessage={handleSendRoomMessage}
              onAskAi={handleAskAiInRoom}
              onExplainAnalogy={handleExplainWithAnalogy}
              onSaveToTopic={handleStartSaveToTopic}
              onToggleReaction={toggleFirebaseReaction}
              isLoading={isLoading}
              isSidebarOpen={isSidebarOpen}
            />
          )}
          {!activeConversation && !activeRoom && (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                <img src="https://iili.io/K4QGIa9.png" alt="Pixel AI" className="w-32 h-32 mb-8 animate-bounce" />
                <h1 className="text-5xl font-black text-indigo-900 mb-4 tracking-tighter">PIXEL AI</h1>
                <p className="text-gray-400 max-w-md text-lg">Your interactive educational tutor. Start a chat or a study session to begin learning.</p>
                <button 
                    onClick={handleNewChat}
                    className="mt-8 bg-[#6A5BFF] text-white px-10 py-4 rounded-full font-black text-xl shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
                >
                    Get Started
                </button>
             </div>
          )}
        </main>
      {isGenerating && (
          <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-fade-in">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2 font-black uppercase tracking-tight">Crafting Study Guide</h2>
              <p className="text-gray-500 max-w-xs text-center font-medium">Analyzing snippets with Pixel AI intelligence...</p>
          </div>
      )}
      <NotepadModal isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} notes={notes} onUpdateNotes={setNotes} folders={folders} onUpdateFolders={setFolders} />
      <RoomModal isOpen={isRoomModalOpen} onClose={() => setIsRoomModalOpen(false)} onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      <TelegramModal 
        isOpen={isTelegramModalOpen} 
        onClose={() => setIsTelegramModalOpen(false)} 
        onSave={(token, recipients) => {
            const creds = { token, recipients };
            setTelegramCredentials(creds);
            localStorage.setItem(TELEGRAM_CREDS_KEY, JSON.stringify(creds));
        }} 
        initialToken={telegramCredentials?.token}
        initialRecipients={telegramCredentials?.recipients}
      />
      <TopicSelectorModal isOpen={isTopicSelectorOpen} onClose={() => setIsTopicSelectorOpen(false)} folders={folders} onSaveToTopic={onSaveToTopic} onCreateAndSave={onCreateAndSave} />
      {studyToolState && (
          <StudyToolModal 
            type={studyToolState.type}
            data={studyToolState.data}
            folderName={studyToolState.folderName}
            onClose={() => setStudyToolState(null)}
          />
      )}
    </div>
  );
};

export default App;