
import React, { useState, useRef, useEffect } from 'react';
import type { Conversation, TelegramCredentials, TelegramRecipient, GroundingChunk } from '../types';
import ChatMessage from './ChatMessage';
import { SendIcon, PixelBotIcon, BotAvatar, MicrophoneIcon, ChevronDownIcon, PauseIcon, AttachmentIcon } from './Icons';
import { connectToLiveSession, createBlob, decode, decodeAudioData } from '../services/geminiService';
import type { LiveSession, LiveServerMessage, FunctionDeclaration } from '@google/genai';
import { Type } from '@google/genai';

interface LiveVoiceViewProps {
  onClose: () => void;
  onSendTelegram: (message: string, chatId: string) => Promise<{success: boolean, message: string}>;
  telegramRecipients: TelegramRecipient[];
}

const LiveVoiceView: React.FC<LiveVoiceViewProps> = ({ onClose, onSendTelegram, telegramRecipients }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();
    const timeRef = useRef<number>(0);
    const [isInteracting, setIsInteracting] = useState(false);
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [showAllSources, setShowAllSources] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isNewTurn = useRef(true);

    const sessionPromise = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContext = useRef<AudioContext | null>(null);
    const outputAudioContext = useRef<AudioContext | null>(null);
    const analyserNode = useRef<AnalyserNode | null>(null);
    const microphoneStream = useRef<MediaStream | null>(null);
    const scriptProcessor = useRef<ScriptProcessorNode | null>(null);
    const sourceNode = useRef<MediaStreamAudioSourceNode | null>(null);
    
    const nextStartTime = useRef<number>(0);
    const audioSources = useRef(new Set<AudioBufferSourceNode>());

    const cleanup = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        
        microphoneStream.current?.getTracks().forEach(track => track.stop());
        
        if (scriptProcessor.current) {
            scriptProcessor.current.onaudioprocess = null;
            scriptProcessor.current.disconnect();
            scriptProcessor.current = null;
        }
        if (analyserNode.current && sourceNode.current) {
            sourceNode.current.disconnect(analyserNode.current);
        }
        sourceNode.current = null;

        if (inputAudioContext.current && inputAudioContext.current.state !== 'closed') {
            inputAudioContext.current.close();
        }
        if (outputAudioContext.current && outputAudioContext.current.state !== 'closed') {
            outputAudioContext.current.close();
        }

        sessionPromise.current?.then(session => session.close());
        sessionPromise.current = null;
    };

    const drawWave = (analyser: AnalyserNode) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const avg = dataArray.reduce((a, b) => a + Math.abs(b - 128), 0) / dataArray.length;
        const dynamicAmplitude = Math.max(0.1, Math.min(1.5, avg / 25));

        timeRef.current += 0.04;
        
        // Draw center line
        canvasCtx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
        canvasCtx.lineWidth = 1;
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, canvas.height / 2);
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();

        const drawSine = (config: { frequency: number, amplitude: number, color: string, lineWidth: number, phaseShift?: number }) => {
            canvasCtx.lineWidth = config.lineWidth;
            canvasCtx.strokeStyle = config.color;
            canvasCtx.beginPath();
            
            const centerY = canvas.height / 2;
            const width = canvas.width;
            const phase = config.phaseShift || 0;

            for (let x = 0; x < width; x++) {
                const y = centerY + Math.sin((x * config.frequency) + timeRef.current + phase) * config.amplitude * dynamicAmplitude;
                if (x === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
            }
            canvasCtx.stroke();
        };

        // Wave 3: Faint, low-frequency background wave (light blue)
        drawSine({
            frequency: 0.009,
            amplitude: 35,
            color: 'rgba(142, 182, 222, 0.6)',
            lineWidth: 2,
            phaseShift: Math.PI / 4,
        });

        // Wave 2: Green, medium-frequency wave
        drawSine({
            frequency: 0.012,
            amplitude: 40,
            color: 'rgba(119, 221, 180, 0.8)',
            lineWidth: 2.5,
            phaseShift: Math.PI / 2,
        });

        // Wave 1: Dark blue, high-frequency main wave
        drawSine({
            frequency: 0.025,
            amplitude: 50,
            color: 'rgba(74, 85, 162, 1)',
            lineWidth: 2.5,
        });

        animationFrameRef.current = requestAnimationFrame(() => drawWave(analyser));
    };


    const startInteraction = async () => {
        setError(null); // Reset error on new attempt
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStream.current = stream;
            setSources([]);
            setShowAllSources(false);
            isNewTurn.current = true;

            inputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            analyserNode.current = inputAudioContext.current.createAnalyser();
            analyserNode.current.fftSize = 2048;

            sourceNode.current = inputAudioContext.current.createMediaStreamSource(stream);
            sourceNode.current.connect(analyserNode.current);

            animationFrameRef.current = requestAnimationFrame(() => drawWave(analyserNode.current!));
            
            let liveSystemInstruction: string | undefined = undefined;
            if (telegramRecipients.length > 0) {
                const recipientNames = telegramRecipients.map(r => `"${r.name}"`).join(', ');
                liveSystemInstruction = `You can send Telegram messages on the user's behalf. To do so, use the 'send_telegram_message' function. You must specify the recipient's name exactly as it appears in this list of available recipients: ${recipientNames}.`;
            }

            const sendTelegramFunctionDeclaration: FunctionDeclaration = {
                name: 'send_telegram_message',
                description: 'Sends a message to a specific person via their configured Telegram bot.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        recipient_name: {
                            type: Type.STRING,
                            description: "The name of the person to send the message to. This must be one of the available recipient names provided in the system instructions.",
                        },
                        message: {
                            type: Type.STRING,
                            description: 'The content of the message to send.',
                        },
                    },
                    required: ['recipient_name', 'message'],
                },
            };

            const tools = [{ functionDeclarations: [sendTelegramFunctionDeclaration] }, {googleSearch: {}}];

            sessionPromise.current = connectToLiveSession({
                onopen: () => {
                    const iac = inputAudioContext.current;
                    if (!iac || !sourceNode.current) return; // Safeguard
                    
                    const processor = iac.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.current = processor;
                    processor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    sourceNode.current.connect(processor);
                    processor.connect(iac.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    const hasContent = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data || message.serverContent?.groundingMetadata;

                    if (hasContent && isNewTurn.current) {
                        setSources([]); // Clear sources from previous turn
                        setShowAllSources(false);
                        isNewTurn.current = false;
                    }

                    if (message.serverContent?.groundingMetadata?.groundingChunks) {
                        setSources(message.serverContent.groundingMetadata.groundingChunks);
                    }

                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            if (fc.name === 'send_telegram_message') {
                                const recipientName = fc.args.recipient_name;
                                const text = fc.args.message;
                                const recipient = telegramRecipients.find(r => r.name.toLowerCase() === recipientName?.toLowerCase());
                                
                                let result;
                                if (recipient) {
                                    result = await onSendTelegram(text, recipient.chatId);
                                } else {
                                    result = { success: false, message: `Could not find a recipient named "${recipientName}". Please try again with one of the configured recipient names.` };
                                }

                                sessionPromise.current?.then((session) => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id : fc.id,
                                            name: fc.name,
                                            response: { result: result.message },
                                        }
                                    });
                                });
                            }
                        }
                    }

                    const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64EncodedAudioString && outputAudioContext.current && outputAudioContext.current.state === 'running') {
                        nextStartTime.current = Math.max(nextStartTime.current, outputAudioContext.current!.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContext.current!, 24000, 1);
                        const source = outputAudioContext.current!.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.current!.destination);
                        source.addEventListener('ended', () => { audioSources.current.delete(source); });
                        source.start(nextStartTime.current);
                        nextStartTime.current = nextStartTime.current + audioBuffer.duration;
                        audioSources.current.add(source);
                    }

                    if (message.serverContent?.turnComplete) {
                        isNewTurn.current = true;
                    }

                    if (message.serverContent?.interrupted) {
                        for (const source of audioSources.current.values()) source.stop();
                        audioSources.current.clear();
                        nextStartTime.current = 0;
                        setSources([]);
                    }
                },
                onerror: (e) => { console.error('Live session error:', e); stopAndCleanup(); },
                onclose: () => { stopAndCleanup(); },
            }, tools, liveSystemInstruction);
            setIsInteracting(true);
        } catch (err) {
            console.error('Failed to start voice interaction:', err);
            setIsInteracting(false);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An unknown error occurred while starting the voice session.");
            }
        }
    };
    
    const stopAndCleanup = () => {
        cleanup();
        setIsInteracting(false);
        setSources([]);
        setShowAllSources(false);
    };

    const handleToggleMic = () => {
        if (isInteracting) {
            stopAndCleanup();
        } else {
            startInteraction();
        }
    };

    useEffect(() => {
        return cleanup;
    }, []);
    
    const webSources = sources.filter(chunk => chunk.web);
    const displayedSources = showAllSources ? webSources : webSources.slice(0, 2);

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in">
            <header className="p-4 flex justify-between items-center">
                 <div className="w-6 h-6" /> {/* Spacer */}
                 <h3 className="text-lg font-semibold text-gray-700">Voice Chat</h3>
                <button onClick={onClose} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                    <ChevronDownIcon className="w-6 h-6" />
                </button>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center relative">
                <canvas ref={canvasRef} width="1000" height="200" className="absolute top-1/2 left-0 w-full h-48 -translate-y-1/2" />
                
                 {webSources.length > 0 && (
                    <div className="absolute top-16 w-full max-w-3xl mx-auto px-4">
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-md">
                            <h4 className="text-xs font-semibold text-gray-600 mb-2">Sources:</h4>
                            <ul className="space-y-1 max-h-40 overflow-y-auto">
                                {displayedSources.map((chunk, index) => (
                                    chunk.web && (
                                        <li key={index} className="text-xs">
                                            <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-2">
                                                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">{index + 1}</span>
                                                <span className="truncate">{chunk.web.title || chunk.web.uri}</span>
                                            </a>
                                        </li>
                                    )
                                ))}
                            </ul>
                             {webSources.length > 2 && !showAllSources && (
                                <button
                                    onClick={() => setShowAllSources(true)}
                                    className="text-xs font-semibold text-blue-600 hover:underline mt-2"
                                >
                                    Show {webSources.length - 2} more
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center p-8 z-20">
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-red-600">Failed to Start Voice Session</h3>
                            <p className="mt-2 text-sm text-gray-700">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-6 bg-gray-200 text-gray-800 font-semibold py-2 px-6 rounded-full hover:bg-gray-300 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                <div className="absolute bottom-16 flex flex-col items-center gap-8">
                     <button
                        onClick={handleToggleMic}
                        className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95"
                        style={{ boxShadow: '0 0 20px 5px rgba(106, 91, 255, 0.3)' }}
                        aria-label={isInteracting ? 'Stop interaction' : 'Start interaction'}
                    >
                         <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isInteracting ? 'bg-red-500' : 'bg-indigo-500'}`}>
                            {isInteracting ? (
                                <PauseIcon className="w-8 h-8 text-white" />
                            ) : (
                                <MicrophoneIcon className="w-8 h-8 text-white" />
                            )}
                         </div>
                    </button>
                    <button onClick={onClose} className="text-gray-500 font-semibold py-2 px-6 rounded-full hover:bg-gray-100 transition-colors">
                        End
                    </button>
                </div>
            </main>
        </div>
    );
};


interface ChatViewProps {
  conversation: Conversation;
  onSendMessage: (prompt: string) => void;
  isLoading: boolean;
  isSidebarOpen: boolean;
  telegramCredentials: TelegramCredentials | null;
  onSendTelegram: (message: string, chatId: string) => Promise<{success: boolean, message: string}>;
}

const ChatView: React.FC<ChatViewProps> = ({ conversation, onSendMessage, isLoading, isSidebarOpen, telegramCredentials, onSendTelegram }) => {
    const [input, setInput] = useState('');
    const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
    const [telegramStatus, setTelegramStatus] = useState('');

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const { messages } = conversation;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        const trimmedInput = input.trim();
        if (!trimmedInput || isLoading) return;

        const telegramMatch = trimmedInput.match(/^@([\w\s.-]+) (.*)/s);

        if (telegramMatch) {
            if (telegramCredentials?.recipients && telegramCredentials.recipients.length > 0) {
                const recipientName = telegramMatch[1].trim();
                const message = telegramMatch[2].trim();
                const recipient = telegramCredentials.recipients.find(r => r.name.toLowerCase() === recipientName.toLowerCase());
                
                if (recipient) {
                    const result = await onSendTelegram(message, recipient.chatId);
                    setTelegramStatus(result.message);
                    setTimeout(() => setTelegramStatus(''), 3000);
                    setInput('');
                } else {
                    setTelegramStatus(`Recipient "${recipientName}" not found. Check your configuration or spelling.`);
                    setTimeout(() => setTelegramStatus(''), 5000);
                }
            } else {
                setTelegramStatus("No Telegram recipients configured. Please add recipients in the settings.");
                setTimeout(() => setTelegramStatus(''), 5000);
            }
        } else {
            onSendMessage(trimmedInput);
            setInput('');
        }
    };
    
    const showLoadingIndicator = isLoading && messages.length > 0 && messages[messages.length-1].role === 'model';

    return (
        <div className="flex flex-col h-full">
            <header className={`py-4 border-b border-gray-200 ${isSidebarOpen ? 'px-8' : 'pl-20 pr-8'}`}>
                <h2 className="text-lg font-semibold text-gray-800 truncate">{conversation.title}</h2>
            </header>

            <div className="flex-1 overflow-y-auto p-8 md:p-12">
                {messages.length === 0 && !isLoading ? (
                     <div className="flex flex-col items-center justify-center h-full text-center">
                        <PixelBotIcon className="w-20 h-20 mb-6" />
                        <h2 className="text-3xl font-bold text-gray-800 mb-2">Hi, I'm Pixel AI</h2>
                        <p className="text-gray-500">How can I help you today?</p>
                    </div>
                ) : (
                    <div className="space-y-8 w-full max-w-3xl mx-auto">
                        {messages.map((msg) => (
                            <ChatMessage key={msg.id} message={msg} />
                        ))}
                         {showLoadingIndicator && (
                            <div className="flex items-start space-x-4">
                                <BotAvatar className="w-8 h-8 mt-1" />
                                <div className="flex items-center space-x-1 mt-3">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                                </div>
                            </div>
                         )}
                         <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="px-4 md:px-6 pb-4">
                <div className="w-full max-w-3xl mx-auto">
                    {telegramStatus && <p className="text-center text-sm text-gray-500 mb-2 transition-opacity">{telegramStatus}</p>}
                    <div className="bg-white rounded-full shadow-md flex items-center p-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask Pixel Ai or type @recipient to message"
                            className="flex-1 bg-transparent border-none text-sm text-gray-800 placeholder-gray-500 placeholder:font-extrabold focus:outline-none focus:ring-0 px-4"
                            disabled={isLoading}
                        />
                        <button 
                            onClick={() => setIsLiveViewOpen(true)}
                            className="p-2.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors mr-2"
                        >
                            <AttachmentIcon className="w-7 h-7" />
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="p-2.5 ml-2 rounded-full bg-[#6A5BFF] text-white hover:bg-opacity-90 disabled:bg-gray-300 transition-colors"
                        >
                            <SendIcon className="w-5 h-5 transform rotate-90" />
                        </button>
                    </div>
                </div>
            </div>
            {isLiveViewOpen && <LiveVoiceView onClose={() => setIsLiveViewOpen(false)} onSendTelegram={onSendTelegram} telegramRecipients={telegramCredentials?.recipients || []} />}
        </div>
    );
};

export default ChatView;
