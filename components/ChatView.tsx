



import React, { useState, useRef, useEffect } from 'react';
import type { Conversation } from '../types';
import ChatMessage from './ChatMessage';
import { SendIcon, PixelBotIcon, BotAvatar, MicrophoneIcon, ChevronDownIcon, PauseIcon, AttachmentIcon, CloseIcon } from './Icons';
import { connectToLiveSession, createBlob, decode, decodeAudioData } from '../services/geminiService';
import type { LiveSession, LiveServerMessage } from '@google/genai';

const LiveVoiceView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();
    const timeRef = useRef<number>(0);
    const [isInteracting, setIsInteracting] = useState(false);

    const sessionPromise = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContext = useRef<AudioContext | null>(null);
    const outputAudioContext = useRef<AudioContext | null>(null);
    const analyserNode = useRef<AnalyserNode | null>(null);
    const microphoneStream = useRef<MediaStream | null>(null);
    const scriptProcessor = useRef<ScriptProcessorNode | null>(null);
    const sourceNode = useRef<MediaStreamAudioSourceNode | null>(null);
    
    const nextStartTime = useRef<number>(0);
    const sources = useRef(new Set<AudioBufferSourceNode>());

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
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStream.current = stream;

            inputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            analyserNode.current = inputAudioContext.current.createAnalyser();
            analyserNode.current.fftSize = 2048;

            sourceNode.current = inputAudioContext.current.createMediaStreamSource(stream);
            sourceNode.current.connect(analyserNode.current);

            animationFrameRef.current = requestAnimationFrame(() => drawWave(analyserNode.current!));

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
                    const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64EncodedAudioString && outputAudioContext.current && outputAudioContext.current.state === 'running') {
                        nextStartTime.current = Math.max(nextStartTime.current, outputAudioContext.current!.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContext.current!, 24000, 1);
                        const source = outputAudioContext.current!.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.current!.destination);
                        source.addEventListener('ended', () => { sources.current.delete(source); });
                        source.start(nextStartTime.current);
                        nextStartTime.current = nextStartTime.current + audioBuffer.duration;
                        sources.current.add(source);
                    }

                    if (message.serverContent?.interrupted) {
                        for (const source of sources.current.values()) source.stop();
                        sources.current.clear();
                        nextStartTime.current = 0;
                    }
                },
                onerror: (e) => { console.error('Live session error:', e); stopAndCleanup(); },
                onclose: () => { stopAndCleanup(); },
            });
            setIsInteracting(true);
        } catch (err) {
            console.error('Failed to get microphone access:', err);
            setIsInteracting(false);
        }
    };
    
    const stopAndCleanup = () => {
        cleanup();
        setIsInteracting(false);
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
}

const ChatView: React.FC<ChatViewProps> = ({ conversation, onSendMessage, isLoading, isSidebarOpen }) => {
    const [input, setInput] = useState('');
    const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const { messages } = conversation;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || isLoading) return;
        onSendMessage(input);
        setInput('');
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
                    <div className="bg-white rounded-full shadow-md flex items-center p-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask Pixel Ai"
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
                            className="p-2.5 rounded-full bg-[#6A5BFF] text-white hover:bg-opacity-90 disabled:bg-gray-300 transition-colors"
                        >
                            <SendIcon className="w-5 h-5 transform rotate-90" />
                        </button>
                    </div>
                </div>
            </div>
            {isLiveViewOpen && <LiveVoiceView onClose={() => setIsLiveViewOpen(false)} />}
        </div>
    );
};

export default ChatView;