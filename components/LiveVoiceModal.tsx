import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, MicrophoneIcon, SpeakerIcon } from './Icons';
import { connectToLiveSession, createBlob, decode, decodeAudioData } from '../services/geminiService';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationTitle: string;
}

const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({ isOpen, onClose, conversationTitle }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'talking' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  // cleanup on close
  useEffect(() => {
    if (!isOpen) {
        cleanup();
    }
    return () => cleanup();
  }, [isOpen]);

  const cleanup = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    sessionRef.current?.close();
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    sessionRef.current = null;
    setStatus('idle');
    setErrorMessage(null);
  };

  const startVoiceSession = async () => {
    // Crucial: Create AudioContexts immediately in the user gesture tick
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    inputAudioContextRef.current = inputCtx;
    outputAudioContextRef.current = outputCtx;
    
    setStatus('connecting');
    setErrorMessage(null);

    try {
        // Must be triggered by user interaction to avoid 'Permission dismissed'
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const analyser = inputCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        const source = inputCtx.createMediaStreamSource(stream);
        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
        
        const sessionPromise = connectToLiveSession({
          onopen: () => {
            setStatus('listening');
            source.connect(analyser);
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: any) => {
            const audioBase64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64) {
              setStatus('talking');
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioBase64), outputCtx, 24000, 1);
              const audioSource = outputCtx.createBufferSource();
              audioSource.buffer = buffer;
              audioSource.connect(outputCtx.destination);
              audioSource.onended = () => {
                sourcesRef.current.delete(audioSource);
                if (sourcesRef.current.size === 0) setStatus('listening');
              };
              audioSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(audioSource);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                  try { s.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setStatus('listening');
            }
          },
          onerror: (e: any) => {
            console.error("Live Session Error:", e);
            setStatus('error');
            setErrorMessage("Voice Intelligence connection failed. Please retry.");
          },
          onclose: () => {
             setStatus('idle');
          }
        });

        sessionRef.current = await sessionPromise;

        scriptProcessor.onaudioprocess = (e) => {
          if (isMuted || !sessionRef.current) return;
          const inputData = e.inputBuffer.getChannelData(0);
          sessionRef.current.sendRealtimeInput({ media: createBlob(inputData) });
        };

        drawWaveform();
    } catch (err: any) {
        console.error("Failed to start voice session:", err);
        setStatus('error');
        // Handle 'Permission dismissed' specifically
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission dismissed')) {
            setErrorMessage("Microphone access was not granted. Please check your browser's site settings and click the button to try again.");
        } else {
            setErrorMessage("Unexpected audio error. Ensure no other apps are using your microphone.");
        }
    }
  };

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const alpha = dataArray[i] / 255 + 0.2;
        ctx.fillStyle = `rgba(106, 91, 255, ${alpha})`;
        ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);
        x += barWidth + 2;
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };
    render();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-xl p-4 md:p-8 animate-fade-in">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col items-center p-12 relative animate-scale-in">
        <button onClick={onClose} className="absolute top-8 right-8 p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
          <CloseIcon className="w-6 h-6" />
        </button>

        <div className="mb-8 text-center">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Voice Intelligence</p>
          <h2 className="text-2xl font-black text-indigo-900 truncate px-4">{conversationTitle}</h2>
        </div>

        {status === 'idle' ? (
          <div className="flex flex-col items-center py-10 animate-fade-in">
             <div className="w-40 h-40 bg-indigo-50 rounded-full flex items-center justify-center mb-10 shadow-inner group relative">
                <MicrophoneIcon className="w-16 h-16 text-indigo-300 group-hover:scale-110 transition-transform" />
             </div>
             <p className="text-gray-600 font-bold mb-8 text-center max-w-xs leading-relaxed">
                Start a live conversation. Ensure your microphone is ready.
             </p>
             <button 
                onClick={startVoiceSession}
                className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
             >
                Activate Microphone
             </button>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center py-10 animate-fade-in text-center">
             <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                <CloseIcon className="w-12 h-12" />
             </div>
             <p className="text-red-600 font-bold mb-8 max-w-xs leading-relaxed">
                {errorMessage}
             </p>
             <button 
                onClick={startVoiceSession}
                className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95 border border-gray-200 shadow-sm"
             >
                Retry Connection
             </button>
          </div>
        ) : (
          <>
            <div className="relative w-full aspect-square flex items-center justify-center mb-12">
                <div className={`absolute inset-0 bg-indigo-50 rounded-full transition-all duration-1000 ${status === 'talking' ? 'scale-110 opacity-50' : 'scale-100 opacity-100'}`}></div>
                <canvas ref={canvasRef} width={300} height={100} className="relative z-10 w-full px-8" />
                <div className={`absolute w-32 h-32 rounded-full border-4 border-indigo-200 animate-ping opacity-20 ${status === 'listening' ? 'block' : 'hidden'}`}></div>
                <div className="absolute inset-0 flex items-center justify-center">
                     <div className={`p-8 rounded-full shadow-2xl transition-all duration-500 ${status === 'talking' ? 'bg-indigo-600 text-white scale-110' : 'bg-white text-indigo-600'}`}>
                        {status === 'talking' ? <SpeakerIcon className="w-12 h-12" /> : <MicrophoneIcon className="w-12 h-12" />}
                     </div>
                </div>
            </div>

            <div className="text-center space-y-4 w-full">
                <div className="flex flex-col items-center gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        status === 'listening' ? 'bg-green-100 text-green-600' :
                        status === 'talking' ? 'bg-indigo-100 text-indigo-600' :
                        'bg-gray-100 text-gray-500'
                    }`}>
                        {status === 'connecting' && "Waking Pixel..."}
                        {status === 'listening' && "Listening..."}
                        {status === 'talking' && "Pixel is teaching..."}
                    </span>
                    <p className="text-xs text-gray-400 font-bold">Tip: Ask about concepts step-by-step.</p>
                </div>

                <div className="flex gap-4 pt-4 justify-center">
                    <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`px-6 py-4 rounded-2xl border font-bold text-sm transition-all ${isMuted ? 'bg-red-50 border-red-100 text-red-500' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}`}
                    >
                        {isMuted ? "Unmute" : "Mute Mic"}
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl transition-all active:scale-95"
                    >
                        End Session
                    </button>
                </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LiveVoiceModal;