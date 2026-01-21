import React, { useState, useRef, useEffect } from 'react';
import type { Conversation, TelegramCredentials, TelegramRecipient, GroundingChunk } from '../types';
import ChatMessage from './ChatMessage';
import { SendIcon, PixelBotIcon, BotAvatar, MenuIcon, MicrophoneIcon, SpeakerIcon } from './Icons';
import LiveVoiceModal from './LiveVoiceModal';

interface ChatViewProps {
  conversation: Conversation;
  onSendMessage: (prompt: string) => void;
  onSimplify: (content: string) => void;
  onAddToFolder: (content: string) => void;
  isLoading: boolean;
  isSidebarOpen: boolean;
  telegramCredentials: TelegramCredentials | null;
  onSendTelegram: (message: string, chatId: string) => Promise<{success: boolean, message: string}>;
}

const ChatView: React.FC<ChatViewProps> = ({ 
    conversation, 
    onSendMessage, 
    onSimplify,
    onAddToFolder,
    isLoading, 
    isSidebarOpen, 
    telegramCredentials, 
    onSendTelegram 
}) => {
    const [input, setInput] = useState('');
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const { messages } = conversation;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;
        onSendMessage(trimmed);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            <header className={`h-20 border-b border-gray-100 flex items-center justify-between bg-white/90 backdrop-blur-md z-[50] sticky top-0 transition-all ${isSidebarOpen ? 'px-8' : 'pl-24 pr-8'}`}>
                <h2 className="text-xl font-black text-indigo-900 truncate max-w-md">{conversation.title}</h2>
                <button 
                    onClick={() => setIsVoiceModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all border border-indigo-100"
                >
                    <SpeakerIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Live Voice</span>
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-12 scroll-smooth bg-[#F9F9F9]/30">
                {messages.length === 0 && !isLoading ? (
                     <div className="flex flex-col items-center justify-center h-full text-center py-20 animate-fade-in">
                        <div className="bg-white p-6 rounded-[3rem] shadow-2xl shadow-indigo-100 border border-indigo-50 mb-8">
                            <PixelBotIcon className="w-32 h-32" />
                        </div>
                        <h2 className="text-5xl font-black text-indigo-900 mb-4 tracking-tight">Pixel AI</h2>
                        <p className="text-indigo-400 font-bold text-xl uppercase tracking-widest max-w-lg">Advanced Pedagogical Tutor</p>
                        <div className="mt-12 flex flex-wrap justify-center gap-3 max-w-2xl">
                            {['Explain Quantum Physics', 'Help me with Calculus', 'Write a Biology quiz', 'Simplify Einstein Relativity'].map(suggestion => (
                                <button 
                                    key={suggestion}
                                    onClick={() => onSendMessage(suggestion)}
                                    className="px-6 py-3 bg-white border border-indigo-50 text-indigo-600 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md hover:bg-indigo-50 transition-all"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12 w-full max-w-3xl mx-auto pb-32">
                        {messages.map((msg) => (
                            <ChatMessage 
                                key={msg.id} 
                                message={msg} 
                                onSimplify={onSimplify}
                                onAddToFolder={onAddToFolder}
                            />
                        ))}
                         {isLoading && messages.length > 0 && messages[messages.length-1].role === 'user' && (
                            <div className="flex items-start space-x-4 animate-pulse">
                                <BotAvatar className="w-10 h-10 rounded-2xl" />
                                <div className="flex items-center space-x-2 p-5 bg-white border border-indigo-50 rounded-3xl rounded-tl-sm shadow-sm">
                                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                                </div>
                            </div>
                         )}
                         <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input area */}
            <div className="absolute bottom-0 left-0 right-0 px-4 md:px-12 pb-8 pt-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
                <div className="w-full max-w-3xl mx-auto pointer-events-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(106,91,255,0.12)] flex items-center p-3 border border-indigo-50/50">
                        <button 
                            onClick={() => setIsVoiceModalOpen(true)}
                            className="p-3 text-indigo-400 hover:text-indigo-600 transition-colors ml-2"
                            title="Voice Mode"
                        >
                            <MicrophoneIcon className="w-6 h-6" />
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask your study question..."
                            className="flex-1 bg-transparent border-none text-base text-indigo-900 placeholder-indigo-300 focus:outline-none focus:ring-0 px-4 font-bold"
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="p-4 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-200 transition-all shadow-xl shadow-indigo-200"
                        >
                            <SendIcon className="w-6 h-6 transform rotate-90" />
                        </button>
                    </div>
                    <p className="text-[9px] text-center text-indigo-300 mt-4 font-black uppercase tracking-[0.3em]">
                        Student-First AI Intelligence
                    </p>
                </div>
            </div>

            <LiveVoiceModal 
                isOpen={isVoiceModalOpen} 
                onClose={() => setIsVoiceModalOpen(false)} 
                conversationTitle={conversation.title}
            />
        </div>
    );
};

export default ChatView;