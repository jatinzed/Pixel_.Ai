
import React, { useMemo } from 'react';
import type { RoomMessage } from '../types';
import { UserAvatar, BotAvatar, FaceSmileIcon } from './Icons';

// This is a simplified version for room messages.
// For a full implementation, you would use the same robust markdown/mathjax rendering as in ChatMessage.tsx
const MessageContent: React.FC<{ content: string }> = ({ content }) => {
    const html = useMemo(() => {
        if (window.marked && window.DOMPurify) {
            return window.DOMPurify.sanitize(window.marked.parse(content, { gfm: true, breaks: true }));
        }
        return content.replace(/\n/g, '<br />');
    }, [content]);

    return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
};


const RoomMessageComponent: React.FC<{ message: RoomMessage, currentUserId: string }> = ({ message, currentUserId }) => {
  const isCurrentUser = message.senderId === currentUserId;
  const isBot = message.senderId === 'PixelBot';

  if (isCurrentUser) {
    return (
      <div className="flex justify-end group">
        <div className="flex items-start gap-3">
           <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                <button className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
                    <FaceSmileIcon className="w-4 h-4" />
                </button>
            </div>
          <div className="bg-[#6A5BFF] text-white py-3 px-5 rounded-3xl rounded-br-lg max-w-xl">
            <MessageContent content={message.text} />
          </div>
          <UserAvatar className="w-8 h-8 flex-shrink-0" />
        </div>
      </div>
    );
  }

  // Bot Message
  if (isBot) {
     return (
        <div className="flex justify-start group">
            <div className="flex items-start gap-3">
                <BotAvatar className="w-8 h-8 flex-shrink-0" />
                <div className="bg-gray-100 text-gray-800 py-3 px-5 rounded-3xl rounded-bl-lg max-w-xl">
                    <p className="text-xs font-bold text-indigo-600 mb-1">Pixel AI</p>
                    <MessageContent content={message.text} />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                    <button className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
                        <FaceSmileIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
  }

  // Other User's Message
  return (
    <div className="flex justify-start group">
        <div className="flex items-start gap-3">
            <img src="https://iili.io/K6NVP8x.png" alt="User Avatar" className="w-8 h-8 flex-shrink-0 rounded-full" />
            <div className="bg-white border border-gray-100 text-gray-800 py-3 px-5 rounded-3xl rounded-bl-lg max-w-xl">
                <p className="text-xs font-bold text-gray-500 mb-1">{message.senderId}</p>
                <MessageContent content={message.text} />
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                <button className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
                    <FaceSmileIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
  );
};

export default RoomMessageComponent;