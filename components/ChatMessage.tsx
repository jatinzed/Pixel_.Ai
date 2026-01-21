import React, { useState } from 'react';
import { Message } from '../types';
import { UserAvatar, BotAvatar, LightbulbIcon, FolderPlusIcon } from './Icons';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatMessageProps {
  message: Message;
  onExplainAnalogy?: (content: string) => void;
  onSaveToTopic?: (content: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onExplainAnalogy, onSaveToTopic }) => {
  const isUser = message.role === 'user';
  const [showAllSources, setShowAllSources] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-3">
          <div className="bg-[#6A5BFF] text-white py-3 px-5 rounded-3xl rounded-br-lg max-w-2xl">
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
          </div>
          <UserAvatar className="w-8 h-8 flex-shrink-0" />
        </div>
      </div>
    );
  }

  const sources = message.groundingMetadata?.groundingChunks?.filter(c => c.web) || [];
  const displayedSources = showAllSources ? sources : sources.slice(0, 2);

  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3">
        <BotAvatar className="w-8 h-8 flex-shrink-0" />
        <div className="flex flex-col gap-2">
            <div className="bg-gray-100 text-gray-800 py-3 px-5 rounded-3xl rounded-bl-lg max-w-2xl">
            <MarkdownRenderer content={message.content} />
            {sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">Sources:</h4>
                <ul className="space-y-2">
                    {displayedSources.map((chunk, index) => (
                    chunk.web && (
                        <li key={index} className="text-xs">
                        <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">{index + 1}</span>
                            <span className="truncate">{chunk.web.title || chunk.web.uri}</span>
                        </a>
                        </li>
                    )
                    ))}
                </ul>
                {sources.length > 2 && !showAllSources && (
                    <button
                    onClick={() => setShowAllSources(true)}
                    className="text-xs font-semibold text-blue-600 hover:underline mt-2"
                    >
                    Show {sources.length - 2} more
                    </button>
                )}
                </div>
            )}
            </div>
            
            {/* Student Helper Tools */}
            <div className="flex items-center gap-3 px-2">
                <button 
                    onClick={() => onExplainAnalogy?.(message.content)}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full hover:bg-amber-100 transition-colors"
                    title="Explain with an analogy"
                >
                    <LightbulbIcon className="w-4 h-4" />
                    <span>Explain with Analogy</span>
                </button>
                <button 
                    onClick={() => onSaveToTopic?.(message.content)}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
                    title="Add to topic folder"
                >
                    <FolderPlusIcon className="w-4 h-4" />
                    <span>Save to Topic</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;