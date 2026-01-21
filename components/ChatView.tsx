import React, { useState, useRef, useEffect } from 'react';
import type { Conversation, TelegramCredentials, TelegramRecipient, GroundingChunk } from '../types';
import ChatMessage from './ChatMessage';
import { SendIcon, PixelBotIcon, BotAvatar, MicrophoneIcon, ChevronDownIcon, PauseIcon, AttachmentIcon } from './Icons';
import { connectToLiveSession, createBlob, decode, decodeAudioData } from '../services/geminiService';
import type { LiveServerMessage, FunctionDeclaration } from '@google/genai';
import { Type } from '@google/genai';

type LiveSession = Awaited<ReturnType<typeof connectToLiveSession>>;

interface LiveVoiceViewProps {
  onClose: () => void;
  onSendTelegram: (message: string, chatId: string) => Promise<{success: boolean, message: string}>;
  telegramRecipients: TelegramRecipient[];
}

const LiveVoiceView: React.FC<LiveVoiceViewProps> = ({ onClose, onSendTelegram, telegramRecipients }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);
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
        if (analyserNode.current && sourceNode.current) sourceNode.current.disconnect(analyserNode.current);
        sourceNode.current = null;
        if (inputAudioContext.current && inputAudioContext.current.state !== 'closed') inputAudioContext.current.close();
        if (outputAudioContext.current && outputAudioContext.current.state !== 'closed') outputAudioContext.current.close();
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
                if (x === 0) canvasCtx.moveTo(x, y); else canvasCtx.lineTo(x, y);
            }
            canvasCtx.stroke();
        };
        drawSine({ frequency: 0.009, amplitude: 35, color: 'rgba(142, 182, 222, 0.6)', lineWidth: 2, phaseShift: Math.PI / 4 });
        drawSine({ frequency: 0.012, amplitude: 40, color: 'rgba(119, 221, 180, 0.8)', lineWidth: 2.5, phaseShift: Math.PI / 2 });
        drawSine({ frequency: 0.025, amplitude: 50, color: 'rgba(74, 85, 162, 1)', lineWidth: 2.5 });
        animationFrameRef.current = requestAnimationFrame(() => drawWave(analyser));
    };

    const startInteraction = async () => {
        setError(null);
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
                liveSystemInstruction = `You can send Telegram messages on the user's behalf using the 'send_telegram_message' function. Available recipients: ${recipientNames}.`;
            }
            const tools = [{ functionDeclarations: [{ name: 'send_telegram_message', description: 'Sends a message to a person via Telegram.', parameters: { type: Type.OBJECT, properties: { recipient_name: { type: Type.STRING }, message: { type: Type.STRING } }, required: ['recipient_name', 'message'] } }] }];
            sessionPromise.current = connectToLiveSession({
                onopen: () => {
                    const processor = inputAudioContext.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.current = processor;
                    processor.onaudioprocess = (e) => {
                        const pcmBlob = createBlob(e.inputBuffer.getChannelData(0));
                        sessionPromise.current?.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                    };
                    sourceNode.current!.connect(processor);
                    processor.connect(inputAudioContext.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data && isNewTurn.current) { setSources([]); isNewTurn.current = false; }
                    if (message.serverContent?.groundingMetadata?.groundingChunks) setSources(message.serverContent.groundingMetadata.groundingChunks);
                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            if (fc.name === 'send_telegram_message') {
                                const args = fc.args as any;
                                const recipient = telegramRecipients.find(r => r.name.toLowerCase() === args.recipient_name?.toLowerCase());
                                const res = recipient ? await onSendTelegram(args.message, recipient.chatId) : { message: 'Recipient not found' };
                                sessionPromise.current?.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: res.message } } }));
                            }
                        }
                    }
                    const audioStr = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioStr && outputAudioContext.current?.state === 'running') {
                        nextStartTime.current = Math.max(nextStartTime.current, outputAudioContext.current!.currentTime);
                        const buf = await decodeAudioData(decode(audioStr), outputAudioContext.current!, 24000, 1);
                        const src = outputAudioContext.current!.createBufferSource();
                        src.buffer = buf;
                        src.connect(outputAudioContext.current!.destination);
                        src.addEventListener('ended', () => audioSources.current.delete(src));
                        src.start(nextStartTime.current);
                        nextStartTime.current += buf.duration;
                        audioSources.current.add(src);
                    }
                    if (message.serverContent?.turnComplete) isNewTurn.current = true;
                    if (message.serverContent?.interrupted) { for (const s of audioSources.current) s.stop(); audioSources.current.clear(); nextStartTime.current = 0; }
                },
                onerror: () => stopAndCleanup(),
                onclose: () => stopAndCleanup(),
            }, tools, liveSystemInstruction);
            setIsInteracting(true);
        } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); setIsInteracting(false); }
    };
    
    const stopAndCleanup = () => { cleanup(); setIsInteracting(false); setSources([]); };
    useEffect(() => cleanup, []);
    
    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in">
            <header className="p-4 flex justify-between items-center">
                 <div className="w-6 h-6" />
                 <h3 className="text-lg font-semibold text-gray-700 font-extrabold uppercase tracking-widest">Pixel Voice</h3>
                <button onClick={onClose} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"><ChevronDownIcon className="w-6 h-6" /></button>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center relative">
                <canvas ref={canvasRef} width="1000" height="200" className="absolute top-1/2 left-0 w-full h-48 -translate-y-1/2" />
                {error && <div className="absolute inset-0 bg-white/90 flex items-center justify-center p-8 z-20 text-center"><p className="text-red-600 font-bold">{error}</p></div>}
                <div className="absolute bottom-16 flex flex-col items-center gap-8">
                     <button onClick={() => isInteracting ? stopAndCleanup() : startInteraction()} className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95" style={{ boxShadow: '0 0 20px 5px rgba(106, 91, 255, 0.3)' }}>
                         <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isInteracting ? 'bg-red-500' : 'bg-indigo-500'}`}>{isInteracting ? <PauseIcon className="w-8 h-8 text-white" /> : <MicrophoneIcon className="w-8 h-8 text-white" />}</div>
                    </button>
                    <button onClick={onClose} className="text-gray-400 font-bold tracking-widest uppercase text-xs hover:text-gray-600">End Session</button>
                </div>
            </main>
        </div>
    );
};


interface ChatViewProps {
  conversation: Conversation;
  onSendMessage: (prompt: string) => void;
  onExplainAnalogy: (content: string) => void;
  onSaveToTopic: (content: string) => void;
  isLoading: boolean;
  isSidebarOpen: boolean;
  telegramCredentials: TelegramCredentials | null;
  onSendTelegram: (message: string, chatId: string) => Promise<{success: boolean, message: string}>;
}

const ChatView: React.FC<ChatViewProps> = ({ conversation, onSendMessage, onExplainAnalogy, onSaveToTopic, isLoading, isSidebarOpen, telegramCredentials, onSendTelegram }) => {
    const [input, setInput] = useState('');
    const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversation.messages]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;
        const telegramMatch = trimmed.match(/^@([\w\s.-]+) (.*)/s);
        if (telegramMatch && telegramCredentials?.recipients) {
            const recipient = telegramCredentials.recipients.find(r => r.name.toLowerCase() === telegramMatch[1].trim().toLowerCase());
            if (recipient) await onSendTelegram(telegramMatch[2].trim(), recipient.chatId);
            setInput('');
        } else { onSendMessage(trimmed); setInput(''); }
    };

    return (
        <div className="flex flex-col h-full">
            <header className={`py-4 border-b border-gray-200 ${isSidebarOpen ? 'px-8' : 'pl-20 pr-8'}`}>
                <h2 className="text-lg font-bold text-gray-800 truncate uppercase tracking-tight">{conversation.title}</h2>
            </header>
            <div className="flex-1 overflow-y-auto p-8 md:p-12">
                {conversation.messages.length === 0 && !isLoading ? (
                     <div className="flex flex-col items-center justify-center h-full text-center">
                        <PixelBotIcon className="w-24 h-24 mb-6" />
                        <h2 className="text-4xl font-extrabold text-gray-800 mb-2 tracking-tight">Pixel Study Assistant</h2>
                        <p className="text-gray-400 font-medium max-w-sm">Ask me any question, create topic folders, or ask for analogies to learn faster.</p>
                    </div>
                ) : (
                    <div className="space-y-8 w-full max-w-3xl mx-auto">
                        {conversation.messages.map((msg) => (
                            <ChatMessage key={msg.id} message={msg} onExplainAnalogy={onExplainAnalogy} onSaveToTopic={onSaveToTopic} />
                        ))}
                         {isLoading && conversation.messages[conversation.messages.length-1]?.role === 'model' && (
                            <div className="flex items-start space-x-4"><BotAvatar className="w-8 h-8 mt-1" /><div className="flex items-center space-x-1 mt-3"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div></div></div>
                         )}
                         <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
            <div className="px-4 md:px-6 pb-4">
                <div className="w-full max-w-3xl mx-auto">
                    <div className="bg-white rounded-full shadow-xl shadow-indigo-50 border border-gray-100 flex items-center p-2">
                        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="What would you like to learn?" className="flex-1 bg-transparent border-none text-sm text-gray-800 placeholder-gray-400 font-medium focus:outline-none focus:ring-0 px-4" disabled={isLoading} />
                        <button onClick={() => setIsLiveViewOpen(true)} className="p-3 rounded-full bg-gray-50 text-indigo-600 hover:bg-indigo-50 transition-colors mr-2"><MicrophoneIcon className="w-5 h-5" /></button>
                        <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 rounded-full bg-[#6A5BFF] text-white hover:bg-opacity-90 disabled:bg-gray-300 transition-all shadow-lg shadow-indigo-100"><SendIcon className="w-5 h-5 transform rotate-90" /></button>
                    </div>
                </div>
            </div>
            {isLiveViewOpen && <LiveVoiceView onClose={() => setIsLiveViewOpen(false)} onSendTelegram={onSendTelegram} telegramRecipients={telegramCredentials?.recipients || []} />}
        </div>
    );
};

export default ChatView;