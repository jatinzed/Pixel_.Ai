
import React from 'react';
import { PlusIcon, ImageIcon, MessageIcon, ChevronDoubleLeftIcon, HashtagIcon, PlusCircleIcon, ArrowRightIcon, PaperAirplaneIcon, QuestionMarkCircleIcon } from './Icons';
import { Conversation, Room } from '../types';

interface SidebarProps {
    onToggle: () => void;
    onNewChat: () => void;
    conversations: Conversation[];
    rooms: Room[];
    activeConversationId: string | null;
    activeRoomId: string | null;
    onSelectConversation: (id: string) => void;
    onSelectRoom: (id: string) => void;
    onOpenNotepad: () => void;
    onOpenRoomModal: () => void;
    onOpenTelegramModal: () => void;
    onOpenHelpModal: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    onToggle, 
    onNewChat,
    conversations,
    rooms,
    activeConversationId,
    activeRoomId,
    onSelectConversation,
    onSelectRoom,
    onOpenNotepad,
    onOpenRoomModal,
    onOpenTelegramModal,
    onOpenHelpModal,
}) => {
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
                    className="flex-1 bg-[#6A5BFF] text-white flex items-center justify-center space-x-2 py-3 rounded-full font-semibold hover:bg-opacity-90 transition"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>New chat</span>
                </button>
                <button 
                  onClick={onOpenNotepad}
                  className="p-3 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition">
                    <ImageIcon className="w-6 h-6" />
                </button>
                <button 
                  onClick={onOpenTelegramModal}
                  className="p-3 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition">
                    <PaperAirplaneIcon className="w-6 h-6" />
                </button>
                <button 
                  onClick={onOpenHelpModal}
                  className="p-3 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition"
                  aria-label="Open formatting help"
                  title="Formatting help"
                  >
                    <QuestionMarkCircleIcon className="w-6 h-6" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto -mr-4 pr-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-3">Your Conversations</h2>
                <ul className="space-y-1 mb-6">
                    {conversations.map((convo) => (
                        <li 
                            key={convo.id}
                            onClick={() => onSelectConversation(convo.id)}
                            className={`flex items-center justify-between p-2 px-4 rounded-full cursor-pointer transition-colors ${
                                activeConversationId === convo.id 
                                    ? 'bg-blue-100/50' 
                                    : 'hover:bg-gray-100'
                            }`}
                        >
                            <div className="flex items-center space-x-3 truncate">
                                <MessageIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-800 truncate">{convo.title}</span>
                            </div>
                            {activeConversationId === convo.id && (
                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                            )}
                        </li>
                    ))}
                </ul>

                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-3">Chat Rooms</h2>
                 <div className="flex flex-col space-y-2 mb-4">
                    <button onClick={onOpenRoomModal} className="w-full text-sm font-medium text-gray-600 hover:bg-gray-100 py-2 px-3 rounded-lg flex items-center space-x-2 transition-colors">
                        <PlusCircleIcon className="w-5 h-5 text-indigo-500"/>
                        <span>Create or Join Room</span>
                    </button>
                </div>
                <ul className="space-y-1">
                     {rooms.map((room) => (
                        <li 
                            key={room.id}
                            onClick={() => onSelectRoom(room.id)}
                            className={`flex items-center justify-between p-2 px-4 rounded-full cursor-pointer transition-colors ${
                                activeRoomId === room.id 
                                    ? 'bg-blue-100/50' 
                                    : 'hover:bg-gray-100'
                            }`}
                        >
                            <div className="flex items-center space-x-3 truncate">
                                <HashtagIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-800 truncate">{room.name}</span>
                            </div>
                            {activeRoomId === room.id && (
                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    </aside>
  );
};

export default Sidebar;