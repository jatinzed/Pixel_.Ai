
import React, { useState } from 'react';
import { 
    PlusIcon, 
    ImageIcon, 
    MessageIcon, 
    ChevronDoubleLeftIcon, 
    HashtagIcon, 
    PlusCircleIcon, 
    PaperAirplaneIcon,
    DotsHorizontalIcon,
    FolderPlusIcon,
    LibraryIcon,
    LightbulbIcon,
    // Add missing icon import
    CheckCircleIcon
} from './Icons';
import { Conversation, Room, TopicFolder } from '../types';

interface SidebarProps {
    onToggle: () => void;
    onNewChat: () => void;
    conversations: Conversation[];
    rooms: Room[];
    folders: TopicFolder[];
    activeConversationId: string | null;
    activeRoomId: string | null;
    onSelectConversation: (id: string) => void;
    onSelectRoom: (id: string) => void;
    onOpenNotepad: () => void;
    onOpenRoomModal: () => void;
    onOpenTelegramModal: () => void;
    onGenerateFlashcards: (folderId: string) => void;
    onGenerateQuiz: (folderId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    onToggle, 
    onNewChat,
    conversations,
    rooms,
    folders,
    activeConversationId,
    activeRoomId,
    onSelectConversation,
    onSelectRoom,
    onOpenNotepad,
    onOpenRoomModal,
    onOpenTelegramModal,
    onGenerateFlashcards,
    onGenerateQuiz
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <aside className="h-full bg-white flex flex-col border-r border-gray-100 overflow-hidden">
        <div className="p-4 flex flex-col h-full w-[280px]">
            <header className="mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <img src="https://iili.io/K4QGIa9.png" alt="Pixel AI Logo" className="w-10 h-10" />
                    <h1 className="text-3xl font-extrabold tracking-wider uppercase text-indigo-800">PIXEL AI</h1>
                </div>
                <button onClick={onToggle} className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-md transition-colors">
                    <ChevronDoubleLeftIcon className="w-5 h-5" />
                </button>
            </header>
            
            <div className="mb-6 flex items-center space-x-2">
                <button 
                    onClick={onNewChat}
                    className="flex-1 bg-[#6A5BFF] text-white flex items-center justify-center space-x-2 py-3 rounded-full font-semibold hover:bg-opacity-90 transition shadow-lg shadow-indigo-100"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>New chat</span>
                </button>
                <button 
                  onClick={onOpenNotepad}
                  className="p-3 bg-gray-50 rounded-full text-indigo-600 hover:bg-indigo-100 transition border border-indigo-50">
                    <LibraryIcon className="w-6 h-6" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto -mr-4 pr-4">
                {/* Study Topics Section - The primary study hub */}
                <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-3">Study Library</h2>
                <ul className="space-y-1 mb-8">
                    {folders.length === 0 && (
                        <p className="px-4 text-xs text-gray-400 italic">No topics saved yet.</p>
                    )}
                    {folders.map((folder) => (
                        <li 
                            key={folder.id}
                            className={`group relative flex items-center justify-between p-2 px-4 rounded-full transition-colors ${openMenuId === folder.id ? 'bg-indigo-50' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <div 
                                onClick={onOpenNotepad}
                                className="flex items-center space-x-3 truncate cursor-pointer flex-1"
                            >
                                <FolderPlusIcon className={`w-4 h-4 flex-shrink-0 ${openMenuId === folder.id ? 'text-indigo-600' : 'text-indigo-400'}`} />
                                <span className={`text-sm font-bold truncate ${openMenuId === folder.id ? 'text-indigo-800' : 'text-gray-700'}`}>{folder.name}</span>
                            </div>
                            
                            <div className="relative">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(openMenuId === folder.id ? null : folder.id);
                                    }}
                                    className="p-1.5 rounded-full hover:bg-white text-gray-400 group-hover:text-indigo-600 transition-colors shadow-none hover:shadow-sm"
                                >
                                    <DotsHorizontalIcon className="w-4 h-4" />
                                </button>

                                {openMenuId === folder.id && (
                                    <>
                                        <div 
                                            className="fixed inset-0 z-[60]" 
                                            onClick={() => setOpenMenuId(null)}
                                        />
                                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[70] overflow-hidden animate-fade-in origin-top-right">
                                            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Study Actions</p>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    onGenerateFlashcards(folder.id);
                                                    setOpenMenuId(null);
                                                }}
                                                disabled={folder.snippets.length === 0}
                                                className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-3 transition-colors disabled:opacity-40"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                                    <LightbulbIcon className="w-4 h-4 text-amber-600" />
                                                </div>
                                                Create Flashcards
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    onGenerateQuiz(folder.id);
                                                    setOpenMenuId(null);
                                                }}
                                                disabled={folder.snippets.length === 0}
                                                className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-3 transition-colors disabled:opacity-40"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                                                </div>
                                                Practice Quiz
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                {/* Conversations Section */}
                <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-3">Recent Chats</h2>
                <ul className="space-y-1 mb-8">
                    {conversations.map((convo) => (
                        <li 
                            key={convo.id}
                            onClick={() => onSelectConversation(convo.id)}
                            className={`flex items-center justify-between p-2 px-4 rounded-full cursor-pointer transition-colors ${
                                activeConversationId === convo.id 
                                    ? 'bg-indigo-50 text-indigo-700' 
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center space-x-3 truncate">
                                <MessageIcon className={`w-4 h-4 flex-shrink-0 ${activeConversationId === convo.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                                <span className="text-sm font-bold truncate">{convo.title}</span>
                            </div>
                        </li>
                    ))}
                </ul>

                {/* Rooms Section */}
                <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-3">Study Rooms</h2>
                 <div className="flex flex-col space-y-1 mb-4">
                    <button onClick={onOpenRoomModal} className="w-full text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-2.5 px-4 rounded-full flex items-center space-x-2 transition-all">
                        <PlusCircleIcon className="w-4 h-4"/>
                        <span>New Room</span>
                    </button>
                    <ul className="space-y-1 mt-2">
                        {rooms.map((room) => (
                            <li 
                                key={room.id}
                                onClick={() => onSelectRoom(room.id)}
                                className={`flex items-center justify-between p-2 px-4 rounded-full cursor-pointer transition-colors ${
                                    activeRoomId === room.id 
                                        ? 'bg-indigo-50 text-indigo-700' 
                                        : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center space-x-3 truncate">
                                    <HashtagIcon className={`w-4 h-4 flex-shrink-0 ${activeRoomId === room.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                                    <span className="text-sm font-bold truncate">{room.name}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    </aside>
  );
};

export default Sidebar;
