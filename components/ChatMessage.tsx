
import React, { useState } from 'react';
import { Message } from '../types';
import { UserAvatar, BotAvatar, SparklesIcon, FolderPlusIcon, SpeakerIcon } from './Icons';
import MarkdownRenderer from './MarkdownRenderer';
import { generateSpeech, decode, decodeAudioData } from '../services/geminiService';

interface ChatMessageProps {
    message: Message;
    onSimplify?: (content: string) => void;
    onAddToFolder?: (content: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSimplify, onAddToFolder }) => {
  const isUser = message.role === 'user';
  const [showAllSources, setShowAllSources] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-3">
          <div className="bg-[#6A5BFF] text-white py-3 px-5 rounded-3xl rounded-br-lg max-w-2xl shadow-sm">
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
          </div>
          <UserAvatar className="w-8 h-8 flex-shrink-0" />
        </div>
      </div>
    );
  }

  const handleListen = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
        const audioData = await generateSpeech(message.content);
        if (audioData) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.onended = () => setIsSpeaking(false);
            source.start(0);
        } else {
            setIsSpeaking(false);
        }
    } catch (error) {
        console.error("TTS Error:", error);
        setIsSpeaking(false);
    }
  };

  // Combine web and maps sources
  const webSources = message.groundingMetadata?.groundingChunks?.filter(c => c.web) || [];
  const mapSources = (message.groundingMetadata as any)?.groundingChunks?.filter((c: any) => c.maps) || [];
  const sources = [...webSources, ...mapSources];
  const displayedSources = showAllSources ? sources : sources.slice(0, 3);

  const curiosityMatch = message.content.match(/---[\s\S]*🚀 Deepen your curiosity:[\s\S]*/);
  const coreContent = curiosityMatch ? message.content.replace(curiosityMatch[0], '') : message.content;
  const curiosityContent = curiosityMatch ? curiosityMatch[0] : null;

  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3">
        <BotAvatar className="w-8 h-8 flex-shrink-0" />
        <div className="flex flex-col gap-2 max-w-2xl">
            <div className="bg-white text-gray-800 py-4 px-6 rounded-3xl rounded-bl-lg shadow-sm border border-gray-100">
                <MarkdownRenderer content={coreContent} />
                
                {curiosityContent && (
                    <div className="curiosity-engine">
                         <MarkdownRenderer content={curiosityContent} />
                    </div>
                )}

                {sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Grounded Insights:</h4>
                    <ul className="space-y-2">
                        {displayedSources.map((chunk: any, index) => (
                        (chunk.web || chunk.maps) && (
                            <li key={index} className="text-xs">
                            <a href={chunk.web?.uri || chunk.maps?.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-2">
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{index + 1}</span>
                                <span className="truncate">{chunk.web?.title || chunk.maps?.title || "Explore Place"}</span>
                            </a>
                            </li>
                        )
                        ))}
                    </ul>
                    {sources.length > 3 && !showAllSources && (
                        <button
                        onClick={() => setShowAllSources(true)}
                        className="text-xs font-semibold text-indigo-400 hover:underline mt-2"
                        >
                        Show all {sources.length} sources
                        </button>
                    )}
                    </div>
                )}
            </div>
            
            {!isUser && (
                <div className="flex items-center gap-2 pl-2">
                    <button 
                        onClick={() => onSimplify?.(coreContent)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold hover:bg-indigo-100 transition-colors"
                        title="Explain the easy way"
                    >
                        <SparklesIcon className="w-3.5 h-3.5" />
                        Easy Way
                    </button>
                    <button 
                        onClick={handleListen}
                        disabled={isSpeaking}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSpeaking ? 'bg-indigo-600 text-white animate-pulse' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                        title="Talk with answer"
                    >
                        {isSpeaking ? (
                           <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                              <span>Talking...</span>
                           </div>
                        ) : (
                          <>
                            <SpeakerIcon className="w-3.5 h-3.5" />
                            Listen
                          </>
                        )}
                    </button>
                    <button 
                        onClick={() => onAddToFolder?.(message.content)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full text-xs font-bold hover:bg-gray-100 transition-colors"
                        title="Add to study folder"
                    >
                        <FolderPlusIcon className="w-3.5 h-3.5" />
                        Add to Folder
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
