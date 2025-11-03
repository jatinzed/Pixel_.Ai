
import React, { useEffect, useRef, useMemo } from 'react';
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

    const finalHtml = useMemo(() => {
        if (!window.marked || !window.DOMPurify) {
            return content.replace(/\n/g, '<br />');
        }

        // Protect LaTeX formulas from the Markdown parser
        const mathExpressions: string[] = [];
        const placeholder = (i: number) => `<!--MATHJAX_PLACEHOLDER_${i}-->`;

        const contentWithoutMath = content.replace(
            /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g,
            (match) => {
                const i = mathExpressions.length;
                mathExpressions.push(match);
                return placeholder(i);
            }
        );

        // Parse markdown, sanitize, and restore math
        const rawHtml = window.marked.parse(contentWithoutMath, { gfm: true, breaks: true });
        const sanitizedHtml = window.DOMPurify.sanitize(rawHtml, { KEEP_COMMENTS: true });
        const finalHtmlWithMath = sanitizedHtml.replace(/<!--MATHJAX_PLACEHOLDER_(\d+)-->/g, (match, indexStr) => {
            const index = parseInt(indexStr, 10);
            return mathExpressions[index] || '';
        });
        
        return finalHtmlWithMath;
    }, [content]);

    useEffect(() => {
        const element = contentRef.current;
        if (element && window.MathJax?.startup?.promise) {
            window.MathJax.startup.promise
                .then(() => {
                    if (contentRef.current) { // Re-check ref in case component unmounted
                        window.MathJax.typesetPromise([contentRef.current])
                            .catch((err: any) => console.error('MathJax Typeset Error:', err));
                    }
                });
        }
    }, [finalHtml]); // Re-run effect only when the generated HTML content changes

    return <div ref={contentRef} className="prose" dangerouslySetInnerHTML={{ __html: finalHtml }} />;
};


const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';

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

  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3">
        <BotAvatar className="w-8 h-8 flex-shrink-0" />
        <div className="bg-gray-100 text-gray-800 py-3 px-5 rounded-3xl rounded-bl-lg max-w-2xl">
          <AiMessageContent content={message.content} />
          {Array.isArray(message.groundingMetadata?.groundingChunks) && message.groundingMetadata.groundingChunks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">Sources:</h4>
              <ul className="space-y-2">
                {message.groundingMetadata.groundingChunks.map((chunk, index) => (
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
