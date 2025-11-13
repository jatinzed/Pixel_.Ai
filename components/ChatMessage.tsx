
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Message } from '../types';
import { UserAvatar, BotAvatar } from './Icons';

// Add types for external libraries to the window object
declare global {
  interface Window {
    MathJax: any;
    marked: {
      parse: (markdown: string, options?: any) => string;
    };
    DOMPurify: {
      sanitize: (html: string, config?: object) => string;
    };
  }
}

const AiMessageContent: React.FC<{ content: string }> = ({ content }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const element = contentRef.current;
        if (!element) return;

        // Manually handle DOM updates to prevent conflicts between React and MathJax
        if (!window.marked || !window.DOMPurify) {
            element.innerHTML = content.replace(/\n/g, '<br />');
            return;
        }

        // 1. Isolate math expressions
        const mathExpressions: string[] = [];
        const placeholder = (i: number) => `<span data-math-placeholder="${i}">\u200b</span>`;

        const contentWithoutMath = content.replace(
            /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g,
            (match) => {
                const i = mathExpressions.length;
                mathExpressions.push(match);
                return placeholder(i);
            }
        );

        // 2. Process Markdown and sanitize
        const rawHtml = window.marked.parse(contentWithoutMath, { gfm: true, breaks: true });
        const sanitizedHtml = window.DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['data-math-placeholder'] });
        
        // 3. Re-insert math expressions as raw text
        const finalHtmlWithMath = sanitizedHtml.replace(/<span data-math-placeholder="(\d+)">\u200b<\/span>/g, (match, indexStr) => {
            const index = parseInt(indexStr, 10);
            return mathExpressions[index] || '';
        });
        
        // 4. Set the inner HTML and then typeset with MathJax
        element.innerHTML = finalHtmlWithMath;

        if (window.MathJax?.startup?.promise) {
            window.MathJax.startup.promise
                .then(() => {
                    // Re-check ref in case component unmounted during promise resolution
                    if (contentRef.current) { 
                        window.MathJax.typesetPromise([contentRef.current])
                            .catch((err: any) => console.error('MathJax Typeset Error:', err));
                    }
                });
        }
    }, [content]); // Re-run effect only when the content string changes

    // Render an empty container; the effect hook will manage its content.
    return <div ref={contentRef} className="prose" />;
};


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
          <AiMessageContent content={message.content} />
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
