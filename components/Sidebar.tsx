import React, { useState } from 'react';
import { PlusIcon, MessageIcon, ChevronDoubleLeftIcon, HashtagIcon, PlusCircleIcon, PaperAirplaneIcon, FolderIcon, DotsHorizontalIcon, BrainIcon, ChartBarIcon, EyeIcon, TrashIcon } from './Icons';
import { Conversation, Room, Folder } from '../types';

interface SidebarProps {
    onToggle: () => void;
    onNewChat: () => void;
    conversations: Conversation[];
    rooms: Room[];
    folders: Folder[];
    activeConversationId: string | null;
    activeRoomId: string | null;
    onSelectConversation: (id: string) => void;
    onSelectRoom: (id: string) => void;
    onSelectFolder: (folder: Folder) => void;
    onOpenNotepad: () => void;
    onOpenRoomModal: () => void;
    onOpenTelegramModal: () => void;
    onOpenStudyTools: (folder: Folder, type: 'quiz' | 'flashcards' | 'mindmap') => void;
    onDeleteFolder: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    onToggle, 
    onNewChat,
    conversations,
    rooms,
    folders = [],
    activeConversationId,
    activeRoomId,
    onSelectConversation,
    onSelectRoom,
    onSelectFolder,
    onOpenNotepad,
    onOpenRoomModal,
    onOpenTelegramModal,
    onOpenStudyTools,
    onDeleteFolder
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <aside className="h-full bg-white flex flex-col border-r border-gray-100 overflow-hidden select-none">
        <div className="p-4 flex flex-col h-full w-[280px]">
            <header className="mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <img src="https://iili.io/K4QGIa9.png" alt="Pixel AI Logo" className="w-10 h-10" />
                    <h1 className="text-2xl font-black tracking-tight text-indigo-600">PIXEL</h1>
                </div>
                <button onClick={onToggle} className="p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all">
                    <ChevronDoubleLeftIcon className="w-5 h-5" />
                </button>
            </header>
            
            <div className="mb-6 flex items-center space-x-2">
                <button 
                    onClick={onNewChat}
                    className="flex-1 bg-[#6A5BFF] text-white flex items-center justify-center space-x-2 py-3.5 rounded-2xl font-bold hover:bg-opacity-90 transition shadow-lg shadow-indigo-100"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>New Study Chat</span>
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto -mr-2 pr-2 scrollbar-hide space-y-6">
                <section>
                    <div className="flex items-center justify-between px-2 mb-3">
                        <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Study Folders</h2>
                    </div>
                    <ul className="space-y-1">
                        {folders.length > 0 ? folders.map((folder) => (
                            <li 
                                key={folder.id}
                                className={`group relative flex items-center justify-between p-2.5 px-4 rounded-2xl cursor-pointer transition-all border ${
                                    openMenuId === folder.id ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-indigo-50 border-transparent hover:border-indigo-100'
                                }`}
                                onClick={() => onSelectFolder(folder)}
                            >
                                <div className="flex items-center space-x-3 truncate">
                                    <FolderIcon className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                                    <span className="text-sm font-bold text-gray-700 truncate">{folder.name}</span>
                                </div>
                                <div className="relative">
                                    <button 
                                        className="p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(openMenuId === folder.id ? null : folder.id);
                                        }}
                                    >
                                        <DotsHorizontalIcon className="w-4 h-4" />
                                    </button>
                                    {openMenuId === folder.id && (
                                        <div 
                                            className="absolute right-0 mt-2 w-52 bg-white border border-indigo-50 rounded-2xl shadow-2xl z-[100] py-2 animate-scale-in"
                                            onMouseLeave={() => setOpenMenuId(null)}
                                        >
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onOpenStudyTools(folder, 'quiz'); setOpenMenuId(null); }}
                                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-indigo-50 flex items-center gap-3 transition-colors"
                                            >
                                                <BrainIcon className="w-4 h-4 text-indigo-500" />
                                                Create Study Quiz
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onOpenStudyTools(folder, 'flashcards'); setOpenMenuId(null); }}
                                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-indigo-50 flex items-center gap-3 transition-colors"
                                            >
                                                <ChartBarIcon className="w-4 h-4 text-green-500" />
                                                Create Flashcards
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onOpenStudyTools(folder, 'mindmap'); setOpenMenuId(null); }}
                                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-indigo-50 flex items-center gap-3 transition-colors"
                                            >
                                                <EyeIcon className="w-4 h-4 text-orange-500" />
                                                Visualize Mind Map
                                            </button>
                                            <div className="h-px bg-indigo-50 my-2 mx-4"></div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); setOpenMenuId(null); }}
                                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                                Delete Folder
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        )) : (
                            <div className="px-4 py-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-[10px] text-gray-400 font-bold italic leading-tight">No study folders yet. Save an AI response to get started.</p>
                            </div>
                        )}
                    </ul>
                </section>

                <section>
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 mb-3">Recent Chats</h2>
                    <ul className="space-y-1">
                        {conversations.map((convo) => (
                            <li 
                                key={convo.id}
                                onClick={() => onSelectConversation(convo.id)}
                                className={`flex items-center space-x-3 p-3 px-4 rounded-2xl cursor-pointer transition-all ${
                                    activeConversationId === convo.id 
                                        ? 'bg-indigo-50 border-l-4 border-indigo-600 shadow-sm' 
                                        : 'hover:bg-gray-50'
                                }`}
                            >
                                <MessageIcon className={`w-5 h-5 flex-shrink-0 ${activeConversationId === convo.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                                <span className={`text-sm font-bold truncate ${activeConversationId === convo.id ? 'text-indigo-900' : 'text-gray-600'}`}>
                                    {convo.title}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section>
                    <div className="flex items-center justify-between px-2 mb-3">
                        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Collaboration</h2>
                        <button onClick={onOpenRoomModal} className="text-indigo-600 hover:scale-110 transition-transform">
                            <PlusCircleIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <ul className="space-y-1 pb-10">
                         {rooms.map((room) => (
                            <li 
                                key={room.id}
                                onClick={() => onSelectRoom(room.id)}
                                className={`flex items-center space-x-3 p-3 px-4 rounded-2xl cursor-pointer transition-all ${
                                    activeRoomId === room.id 
                                        ? 'bg-indigo-50 border-l-4 border-indigo-600 shadow-sm' 
                                        : 'hover:bg-gray-50'
                                }`}
                            >
                                <HashtagIcon className={`w-5 h-5 flex-shrink-0 ${activeRoomId === room.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                                <span className={`text-sm font-bold truncate ${activeRoomId === room.id ? 'text-indigo-900' : 'text-gray-600'}`}>
                                    {room.name}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
            
            <footer className="mt-auto pt-4 border-t border-gray-100 bg-white">
                <button 
                  onClick={onOpenTelegramModal}
                  className="w-full flex items-center space-x-3 p-3 rounded-2xl hover:bg-indigo-50 transition-all mb-2"
                >
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <PaperAirplaneIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold text-indigo-900">Telegram Bot</p>
                        <p className="text-[10px] text-indigo-400 font-bold">Sync notifications</p>
                    </div>
                </button>
                <button onClick={onOpenNotepad} className="w-full flex items-center space-x-3 p-3 rounded-2xl hover:bg-indigo-50 transition-all">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <PlusCircleIcon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold text-gray-800">Quick Notes</p>
                        <p className="text-[10px] text-gray-400 font-bold">Ideas & Brainstorming</p>
                    </div>
                </button>
            </footer>
        </div>
    </aside>
  );
};

export default Sidebar;