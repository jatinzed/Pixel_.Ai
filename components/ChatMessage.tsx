import React, { useState } from 'react';
import { Message } from '../types';
import { UserAvatar, BotAvatar, SparklesIcon, FolderPlusIcon } from './Icons';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatMessageProps {
    message: Message;
    onSimplify?: (content: string) => void;
    onAddToFolder?: (content: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSimplify, onAddToFolder }) => {
  const isUser = message.role === 'user';
  const [showAllSources, setShowAllSources] = useState(false);

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

  const sources = message.groundingMetadata?.groundingChunks?.filter(c => c.web) || [];
  const displayedSources = showAllSources ? sources : sources.slice(0, 2);

  // Split response into core content and curiosity engine footer for display
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
                    <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Sources:</h4>
                    <ul className="space-y-2">
                        {displayedSources.map((chunk, index) => (
                        chunk.web && (
                            <li key={index} className="text-xs">
                            <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-2">
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{index + 1}</span>
                                <span className="truncate">{chunk.web.title || chunk.web.uri}</span>
                            </a>
                            </li>
                        )
                        ))}
                    </ul>
                    {sources.length > 2 && !showAllSources && (
                        <button
                        onClick={() => setShowAllSources(true)}
                        className="text-xs font-semibold text-indigo-400 hover:underline mt-2"
                        >
                        Show {sources.length - 2} more
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