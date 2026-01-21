
import React, { useLayoutEffect, useRef } from 'react';

declare global {
  interface Window {
    MathJax: any;
    marked: {
      parse: (markdown: string, options?: any) => string;
    };
    DOMPurify: {
      sanitize: (html: string, config?: object) => string;
    };
    mermaid: {
      initialize: (config: any) => void;
      render: (id: string, text: string) => Promise<{ svg: string }>;
    };
  }
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "prose" }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const element = contentRef.current;
        if (!element) return;

        // Fallback if libraries aren't loaded
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
        
        // 3. Re-insert math expressions
        const finalHtmlWithMath = sanitizedHtml.replace(/<span data-math-placeholder="(\d+)">\u200b<\/span>/g, (match, indexStr) => {
            const index = parseInt(indexStr, 10);
            return mathExpressions[index] || '';
        });
        
        // 4. Set initial HTML
        element.innerHTML = finalHtmlWithMath;

        // 5. Handle Mermaid Diagrams
        const processMermaid = async () => {
            if (!window.mermaid) return;
            
            window.mermaid.initialize({
                startOnLoad: false,
                theme: 'neutral',
                securityLevel: 'loose',
                fontFamily: 'SamsungSharp',
                mindmap: {
                    useMaxWidth: true,
                    padding: 40
                }
            });

            const mermaidBlocks = element.querySelectorAll('pre code.language-mermaid');
            for (let i = 0; i < mermaidBlocks.length; i++) {
                const block = mermaidBlocks[i];
                const pre = block.parentElement;
                if (!pre) continue;
                
                const code = block.textContent || '';
                const id = `mermaid-svg-${Date.now()}-${i}`;
                
                try {
                    const { svg } = await window.mermaid.render(id, code);
                    const wrapper = document.createElement('div');
                    wrapper.className = 'mermaid';
                    wrapper.innerHTML = svg;
                    pre.replaceWith(wrapper);
                } catch (err) {
                    console.error('Mermaid Render Error:', err);
                    // Leave original code block if it fails
                }
            }
        };

        processMermaid();

        // 6. Trigger MathJax typesetting
        if (window.MathJax?.startup?.promise) {
            window.MathJax.startup.promise
                .then(() => {
                    if (contentRef.current) { 
                        window.MathJax.typesetPromise([contentRef.current])
                            .catch((err: any) => console.error('MathJax Typeset Error:', err));
                    }
                });
        }
    }, [content]);

    return <div ref={contentRef} className={className} />;
};

export default MarkdownRenderer;
