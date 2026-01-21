import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, MicrophoneIcon, SpeakerIcon } from './Icons';
import { connectToLiveSession, createBlob, decode, decodeAudioData } from '../services/geminiService';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationTitle: string;
}

const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({ isOpen, onClose, conversationTitle }) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'talking' | 'error'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) return;

    let isComponentMounted = true;
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputCtx;

    const startSession = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const analyser = inputCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        const source = inputCtx.createMediaStreamSource(stream);
        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
        
        const sessionPromise = connectToLiveSession({
          onopen: () => {
            if (isComponentMounted) setStatus('listening');
            source.connect(analyser);
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message) => {
            const audioBase64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64) {
              if (isComponentMounted) setStatus('talking');
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioBase64), outputCtx, 24000, 1);
              const audioSource = outputCtx.createBufferSource();
              audioSource.buffer = buffer;
              audioSource.connect(outputCtx.destination);
              audioSource.onended = () => {
                sourcesRef.current.delete(audioSource);
                if (sourcesRef.current.size === 0 && isComponentMounted) setStatus('listening');
              };
              audioSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(audioSource);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              if (isComponentMounted) setStatus('listening');
            }
          },
          onerror: (e) => {
            console.error("Live Session Error:", e);
            if (isComponentMounted) setStatus('error');
          },
          onclose: () => {
             if (isComponentMounted) onClose();
          }
        });

        sessionRef.current = await sessionPromise;

        scriptProcessor.onaudioprocess = (e) => {
          if (isMuted) return;
          const inputData = e.inputBuffer.getChannelData(0);
          sessionRef.current?.sendRealtimeInput({ media: createBlob(inputData) });
        };

        drawWaveform();
      } catch (err) {
        console.error("Failed to start voice session:", err);
        if (isComponentMounted) setStatus('error');
      }
    };

    startSession();

    return () => {
      isComponentMounted = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      inputCtx.close();
      outputCtx.close();
      sessionRef.current?.close();
    };
  }, [isOpen]);

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyserRef.current!.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const r = 106;
        const g = 91;
        const b = 255;
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${dataArray[i] / 255 + 0.2})`;
        ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);
        x += barWidth + 2;
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };
    render();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-xl p-4 md:p-8">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col items-center p-12 relative animate-scale-in">
        <button onClick={onClose} className="absolute top-8 right-8 p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
          <CloseIcon className="w-6 h-6" />
        </button>

        <div className="mb-8 text-center">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Live Voice Session</p>
          <h2 className="text-2xl font-black text-indigo-900 truncate px-4">{conversationTitle}</h2>
        </div>

        <div className="relative w-full aspect-square flex items-center justify-center mb-12">
            {/* Visualizer Background */}
            <div className={`absolute inset-0 bg-indigo-50 rounded-full transition-all duration-1000 ${status === 'talking' ? 'scale-110 opacity-50' : 'scale-100 opacity-100'}`}></div>
            
            {/* Waveform Canvas */}
            <canvas ref={canvasRef} width={300} height={100} className="relative z-10 w-full px-8" />
            
            {/* Pulse Indicator */}
            <div className={`absolute w-32 h-32 rounded-full border-4 border-indigo-200 animate-ping opacity-20 ${status === 'listening' ? 'block' : 'hidden'}`}></div>
            
            {/* Center Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
                 <div className={`p-8 rounded-full shadow-2xl transition-all duration-500 ${status === 'talking' ? 'bg-indigo-600 text-white scale-110' : 'bg-white text-indigo-600'}`}>
                    {status === 'talking' ? <SpeakerIcon className="w-12 h-12" /> : <MicrophoneIcon className="w-12 h-12" />}
                 </div>
            </div>
        </div>

        <div className="text-center space-y-4">
            <div className="flex flex-col items-center gap-2">
                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                    status === 'listening' ? 'bg-green-100 text-green-600' :
                    status === 'talking' ? 'bg-indigo-100 text-indigo-600' :
                    'bg-gray-100 text-gray-500'
                }`}>
                    {status === 'connecting' && "Initializing Pixel..."}
                    {status === 'listening' && "Pixel is listening..."}
                    {status === 'talking' && "Pixel is talking..."}
                    {status === 'error' && "Connection Error"}
                </span>
                <p className="text-sm text-gray-400 font-medium">Try asking "Tell me more about this topic"</p>
            </div>

            <div className="flex gap-4 pt-4">
                <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-4 rounded-2xl border transition-all ${isMuted ? 'bg-red-50 border-red-100 text-red-500' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}`}
                >
                    {isMuted ? "Unmute Mic" : "Mute Mic"}
                </button>
                <button 
                    onClick={onClose}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                    End Session
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LiveVoiceModal;