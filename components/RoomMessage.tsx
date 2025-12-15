import React, { useState } from 'react';
import type { RoomMessage } from '../types';
import { UserAvatar, BotAvatar, FaceSmileIcon } from './Icons';
import MarkdownRenderer from './MarkdownRenderer';

interface RoomMessageComponentProps {
    message: RoomMessage;
    currentUserId: string;
    onToggleReaction: (messageId: string, emoji: string) => void;
}

const ReactionTally: React.FC<{ message: RoomMessage, currentUserId: string, onToggleReaction: (messageId: string, emoji: string) => void }> = ({ message, currentUserId, onToggleReaction }) => {
    const reactions = message.reactions || {};
    const reactionEntries = (Object.entries(reactions) as [string, string[]][]).filter(([, userIds]) => Array.isArray(userIds) && userIds.length > 0);

    if (reactionEntries.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mt-1.5">
            {reactionEntries.map(([emoji, userIds]) => {
                const hasReacted = userIds.includes(currentUserId);
                return (
                    <button
                        key={emoji}
                        onClick={() => onToggleReaction(message.id, emoji)}
                        className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                            hasReacted 
                                ? 'bg-blue-100 border border-blue-300 text-blue-700' 
                                : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        <span>{emoji}</span>
                        <span className="font-semibold">{userIds.length}</span>
                    </button>
                );
            })}
        </div>
    );
};

const RoomMessageComponent: React.FC<RoomMessageComponentProps> = ({ message, currentUserId, onToggleReaction }) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  
  const isCurrentUser = message.senderId === currentUserId;
  const isBot = message.senderId === 'PixelBot';

  const handleEmojiSelect = (emoji: string) => {
    onToggleReaction(message.id, emoji);
    setIsPickerOpen(false);
  };

  const reactionButton = (
    <div className="relative">
      <button 
        onClick={() => setIsPickerOpen(!isPickerOpen)}
        className="p-1 rounded-full hover:bg-gray-200 text-gray-500"
      >
        <FaceSmileIcon className="w-4 h-4" />
      </button>
      {isPickerOpen && (
        <div className="absolute bottom-full mb-1 flex space-x-1 bg-white p-1.5 rounded-full shadow-lg border border-gray-100 z-10"
          onMouseLeave={() => setIsPickerOpen(false)}
        >
          {availableReactions.map(emoji => (
            <button key={emoji} onClick={() => handleEmojiSelect(emoji)} className="p-1.5 rounded-full hover:bg-gray-200 text-xl transition-transform transform hover:scale-125">
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const messageBubbleClass = "py-3 px-5 rounded-3xl max-w-xl";
  const reactionTallyContainerClass = isCurrentUser ? "justify-end" : "justify-start pl-12";

  if (isCurrentUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="flex justify-end items-start gap-3 group w-full">
          <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
            {reactionButton}
          </div>
          <div className={`${messageBubbleClass} rounded-br-lg bg-[#6A5BFF] text-white`}>
            <MarkdownRenderer content={message.text} />
          </div>
          <UserAvatar className="w-8 h-8 flex-shrink-0" />
        </div>
        <div className={`flex ${reactionTallyContainerClass} w-full max-w-xl pr-12`}>
            <ReactionTally message={message} currentUserId={currentUserId} onToggleReaction={onToggleReaction}/>
        </div>
      </div>
    );
  }

  const sources = message.groundingMetadata?.groundingChunks?.filter(c => c.web) || [];
  const displayedSources = showAllSources ? sources : sources.slice(0, 2);

  if (isBot) {
     return (
        <div className="flex flex-col items-start">
            <div className="flex justify-start items-start gap-3 group w-full">
                <BotAvatar className="w-8 h-8 flex-shrink-0" />
                <div className={`${messageBubbleClass} rounded-bl-lg bg-gray-100 text-gray-800`}>
                    <p className="text-xs font-bold text-indigo-600 mb-1">Pixel AI</p>
                    <MarkdownRenderer content={message.text} />
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
                <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                    {reactionButton}
                </div>
            </div>
            <div className={`flex ${reactionTallyContainerClass} w-full max-w-xl`}>
                <ReactionTally message={message} currentUserId={currentUserId} onToggleReaction={onToggleReaction}/>
            </div>
        </div>
    );
  }

  // Other User's Message
  return (
    <div className="flex flex-col items-start">
        <div className="flex justify-start items-start gap-3 group w-full">
            <img src="https://iili.io/K6NVP8x.png" alt="User Avatar" className="w-8 h-8 flex-shrink-0 rounded-full" />
            <div className={`${messageBubbleClass} rounded-bl-lg bg-white border border-gray-100 text-gray-800`}>
                <p className="text-xs font-bold text-gray-500 mb-1">{message.senderId.substring(0, 14)}</p>
                <MarkdownRenderer content={message.text} />
            </div>
            <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                {reactionButton}
            </div>
        </div>
        <div className={`flex ${reactionTallyContainerClass} w-full max-w-xl`}>
            <ReactionTally message={message} currentUserId={currentUserId} onToggleReaction={onToggleReaction}/>
        </div>
    </div>
  );
};

export default RoomMessageComponent;