import React, { useState, useRef, useEffect } from 'react';
import type { Room, RoomMessage } from '../types';
import RoomMessageComponent from './RoomMessage';
import { SendIcon, UsersIcon } from './Icons';

interface RoomViewProps {
  room: Room;
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onAskAi: (text: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  isLoading: boolean;
  isSidebarOpen: boolean;
}

const RoomView: React.FC<RoomViewProps> = ({ room, currentUserId, onSendMessage, onAskAi, onToggleReaction, isLoading, isSidebarOpen }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [room.messages]);

    const handleSend = () => {
        const trimmedInput = input.trim();
        if (!trimmedInput) return; // Allow sending even if isLoading for optimistic feel

        if (trimmedInput.startsWith('/ask ')) {
            const question = trimmedInput.substring(5);
            onAskAi(question);
        } else {
            onSendMessage(trimmedInput);
        }
        setInput('');
    };

    return (
        <div className="flex flex-col h-full">
            <header className={`py-4 border-b border-gray-200 flex items-center justify-between ${isSidebarOpen ? 'px-8' : 'pl-20 pr-8'}`}>
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 truncate">{room.name}</h2>
                    <p className="text-xs text-gray-500">Room Code: {room.id}</p>
                </div>
                <div className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                    <UsersIcon className="w-5 h-5"/>
                    <span>{room.memberIds.length}</span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 md:p-12">
                <div className="space-y-8 w-full max-w-3xl mx-auto">
                    {room.messages.map((msg) => (
                        <RoomMessageComponent 
                            key={msg.id} 
                            message={msg} 
                            currentUserId={currentUserId} 
                            onToggleReaction={onToggleReaction}
                        />
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="px-4 md:px-6 pb-4">
                <div className="w-full max-w-3xl mx-auto">
                    <div className="bg-white rounded-full shadow-md flex items-center p-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type a message or use /ask to query AI"
                            className="flex-1 bg-transparent border-none text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-0 px-4"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="p-2.5 rounded-full bg-[#6A5BFF] text-white hover:bg-opacity-90 disabled:bg-gray-300 transition-colors"
                        >
                            <SendIcon className="w-5 h-5 transform rotate-90" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoomView;