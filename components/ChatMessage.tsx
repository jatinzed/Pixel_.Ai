import React, { useState } from 'react';
import { Message } from '../types';
import { UserAvatar, BotAvatar } from './Icons';
import MarkdownRenderer from './MarkdownRenderer';

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
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
      </div>
    </div>
  );
};

export default ChatMessage;