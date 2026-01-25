
import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, BrainIcon, ChartBarIcon, EyeIcon } from './Icons';
import { Folder, TelegramCredentials } from '../types';
import { generateStudyMaterial } from '../services/geminiService';

interface StudyToolsModalProps {
    isOpen: boolean;
    onClose: () => void;
    folder: Folder;
    type: 'quiz' | 'flashcards' | 'mindmap';
    telegramCredentials?: TelegramCredentials | null;
    onSendTelegram?: (message: string, chatId: string) => Promise<{success: boolean, message: string}>;
    currentUserId?: string;
}

const StudyToolsModal: React.FC<StudyToolsModalProps> = ({ 
    isOpen, 
    onClose, 
    folder, 
    type,
    telegramCredentials,
    onSendTelegram,
    currentUserId
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [quizIndex, setQuizIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [flashcardIndex, setFlashcardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    
    // Performance Tracking
    const [incorrectTopics, setIncorrectTopics] = useState<Record<string, number>>({});
    
    const visualizerRef = useRef<SVGSVGElement>(null);
    const markmapInstance = useRef<any>(null);

    useEffect(() => {
        if (isOpen && folder) {
            setIsLoading(true);
            setError(null);
            setData(null);
            setQuizIndex(0);
            setScore(0);
            setQuizCompleted(false);
            setFlashcardIndex(0);
            setIsFlipped(false);
            setIncorrectTopics({});

            const content = folder.items.map(i => i.content).join("\n\n");
            generateStudyMaterial(content, type)
                .then(res => {
                    try {
                        if (type === 'mindmap') {
                            const cleaned = res.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
                            setData(cleaned);
                        } else {
                            setData(JSON.parse(res));
                        }
                    } catch (e) {
                        setError("Could not parse study material. The AI output might have been malformed. Please try again.");
                    }
                })
                .catch(err => {
                    setError("Failed to generate study content. Please check your internet.");
                })
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, folder, type]);

    const handleQuizAnswer = (selectedIndex: number) => {
        const q = data.questions[quizIndex];
        const isCorrect = selectedIndex === q.correctAnswerIndex;
        
        const newScore = isCorrect ? score + 1 : score;
        if (isCorrect) {
            setScore(newScore);
        } else {
            setIncorrectTopics(prev => ({
                ...prev,
                [q.category || 'General']: (prev[q.category || 'General'] || 0) + 1
            }));
        }

        if (quizIndex + 1 < data.questions.length) {
            setQuizIndex(quizIndex + 1);
        } else {
            handleCompleteQuiz(newScore);
        }
    };

    const handleCompleteQuiz = async (finalScore: number) => {
        setQuizCompleted(true);
        
        const total: number = data?.questions?.length || 0;
        const percentage = total > 0 ? Math.round((finalScore / total) * 100) : 0;
        
        const sortedWeak = Object.entries(incorrectTopics)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 3)
            .map(([topic]) => topic);

        const weakText = sortedWeak.length > 0 ? sortedWeak.join(", ") : "None! You mastered it all.";
        
        if (onSendTelegram && telegramCredentials?.token && telegramCredentials?.recipients) {
            const studentId = currentUserId ? currentUserId.substring(0, 8) : 'Guest';
            const message = `📊 *Pixel AI - Quiz Report*\n\n📚 *Folder:* ${folder.name}\n👤 *Student:* ${studentId}\n✅ *Score:* ${finalScore}/${total} (${percentage}%)\n⚠️ *Focus Areas:* ${weakText}\n\nKeep learning! 🚀`;
            
            for (const recipient of telegramCredentials.recipients) {
                await onSendTelegram(message, recipient.chatId);
            }
        }
    };

    useEffect(() => {
        if (type === 'mindmap' && data && visualizerRef.current && isOpen) {
            const initMarkmap = (retryCount = 0) => {
                const mm = (window as any).markmap;
                
                // Markmap libraries can sometimes be nested under 'markmap' global
                const Transformer = mm?.Transformer || (window as any).markmap_lib?.Transformer;
                const Markmap = mm?.Markmap;

                if (Transformer && Markmap && visualizerRef.current) {
                    try {
                        const transformer = new Transformer();
                        const { root } = transformer.transform(data);
                        
                        const svg = visualizerRef.current;
                        svg.innerHTML = ''; 

                        markmapInstance.current = Markmap.create(svg, {
                            autoFit: true,
                            duration: 500,
                            paddingX: 32,
                            color: (node: any) => {
                                const colors = ['#6A5BFF', '#818CF8', '#A5B4FC', '#C7D2FE'];
                                return colors[Math.min(node.depth, colors.length - 1)];
                            }
                        }, root);

                        setTimeout(() => {
                            if (markmapInstance.current) {
                                markmapInstance.current.fit();
                            }
                        }, 500);
                    } catch (err) {
                        console.error("Markmap error:", err);
                        setError("Error rendering Knowledge Map.");
                    }
                } else if (retryCount < 50) {
                    setTimeout(() => initMarkmap(retryCount + 1), 200);
                } else {
                    setError("Visualization library failed to load.");
                }
            };
            initMarkmap();
        }
        
        return () => {
            if (markmapInstance.current) {
                try {
                  markmapInstance.current.destroy();
                } catch(e) {}
                markmapInstance.current = null;
            }
        };
    }, [type, data, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-fade-in">
                <header className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                            {type === 'quiz' && <BrainIcon className="w-6 h-6 text-indigo-600" />}
                            {type === 'flashcards' && <ChartBarIcon className="w-6 h-6 text-green-600" />}
                            {type === 'mindmap' && <EyeIcon className="w-6 h-6 text-orange-600" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {type === 'quiz' ? 'Smart Quiz' : type === 'flashcards' ? 'Flashcards' : 'Mind Map'}
                            </h2>
                            <p className="text-xs text-indigo-500 font-bold uppercase tracking-widest">{folder.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>

                <main className="flex-1 overflow-hidden p-0 flex flex-col items-center justify-center bg-[#F9FBFF]">
                    {isLoading ? (
                        <div className="text-center py-20 px-8">
                            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                            <p className="text-lg font-bold text-gray-700">Structuring Learning Paths...</p>
                            <p className="text-sm text-gray-400">Processing folder snippets and searching for context.</p>
                        </div>
                    ) : error ? (
                        <div className="text-center text-red-500 p-10 max-w-md">
                            <p className="text-lg font-bold mb-4">{error}</p>
                            <button onClick={onClose} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full font-bold hover:bg-gray-200">Close</button>
                        </div>
                    ) : (
                        <div className="w-full h-full relative flex flex-col">
                            {type === 'quiz' && data?.questions && (
                                <div className="max-w-2xl mx-auto w-full p-8 overflow-y-auto">
                                    {!quizCompleted ? (
                                        <div className="animate-fade-in">
                                            <div className="flex justify-between items-center mb-8">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Question {quizIndex + 1} of {data.questions.length}</span>
                                                    <span className={`text-[10px] font-black uppercase ${data.questions[quizIndex].difficulty === 'hard' ? 'text-red-500' : 'text-green-500'}`}>
                                                        Difficulty: {data.questions[quizIndex].difficulty}
                                                    </span>
                                                </div>
                                                <span className="text-sm font-bold text-gray-700">Score: {score}</span>
                                            </div>
                                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-indigo-50 mb-8">
                                                <h3 className="text-xl font-bold text-gray-800 leading-tight">{data.questions[quizIndex].question}</h3>
                                                <p className="text-[10px] text-gray-400 mt-2 italic">Topic: {data.questions[quizIndex].category}</p>
                                            </div>
                                            <div className="grid gap-3">
                                                {data.questions[quizIndex].options.map((opt: string, i: number) => (
                                                    <button 
                                                        key={i}
                                                        onClick={() => handleQuizAnswer(i)}
                                                        className="p-4 text-left border-2 border-gray-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all font-bold text-gray-700 bg-white"
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 animate-scale-in">
                                            <div className="text-7xl mb-6">🏆</div>
                                            <h3 className="text-3xl font-bold text-gray-800 mb-2">Quiz Completed!</h3>
                                            <p className="text-2xl text-indigo-600 font-black mb-4">{score} / {data.questions.length}</p>
                                            <div className="bg-white rounded-3xl p-6 border border-indigo-50 mb-8 text-left shadow-sm">
                                                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">Topic Insights</p>
                                                <p className="text-sm text-gray-600 mb-2">Based on your performance, you should focus more on:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(incorrectTopics).length > 0 ? Object.entries(incorrectTopics).map(([topic, count]) => (
                                                        <span key={topic} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold">
                                                            {topic} ({count} mistakes)
                                                        </span>
                                                    )) : <span className="text-green-600 font-bold">Perfect score! No weak topics identified.</span>}
                                                </div>
                                            </div>
                                            <button onClick={onClose} className="px-10 py-4 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-100">Finish Session</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {type === 'flashcards' && data?.flashcards && (
                                <div className="max-w-md mx-auto w-full h-full flex flex-col p-8 overflow-y-auto">
                                    <div className="flex-1 flex items-center justify-center">
                                        <div 
                                            onClick={() => setIsFlipped(!isFlipped)}
                                            className={`relative w-full aspect-[3/4] cursor-pointer perspective-1000 group`}
                                        >
                                            <div className={`relative w-full h-full duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                                                <div className="absolute inset-0 bg-white border-2 border-indigo-100 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl">
                                                    <span className="text-indigo-600 font-black text-3xl mb-8">Q</span>
                                                    <p className="text-xl font-bold text-gray-800 leading-relaxed">{data.flashcards[flashcardIndex].front}</p>
                                                    <span className="absolute bottom-10 text-[10px] font-black text-indigo-200 uppercase tracking-widest">Tap to flip</span>
                                                </div>
                                                <div className="absolute inset-0 bg-indigo-600 border-2 border-indigo-600 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center rotate-y-180 backface-hidden shadow-2xl">
                                                    <span className="text-white font-black text-3xl mb-8">A</span>
                                                    <p className="text-lg font-bold text-white leading-relaxed">{data.flashcards[flashcardIndex].back}</p>
                                                    <span className="absolute bottom-10 text-[10px] font-black text-indigo-200 uppercase tracking-widest">Tap to flip back</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-8 flex items-center justify-between w-full">
                                        <button 
                                            disabled={flashcardIndex === 0}
                                            onClick={() => { setFlashcardIndex(flashcardIndex - 1); setIsFlipped(false); }}
                                            className="p-4 bg-white border border-indigo-100 rounded-full disabled:opacity-30 text-indigo-600"
                                        >
                                            Prev
                                        </button>
                                        <span className="font-black text-indigo-900">{flashcardIndex + 1} / {data.flashcards.length}</span>
                                        <button 
                                            disabled={flashcardIndex === data.flashcards.length - 1}
                                            onClick={() => { setFlashcardIndex(flashcardIndex + 1); setIsFlipped(false); }}
                                            className="p-4 bg-indigo-600 text-white rounded-full disabled:opacity-30"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}

                            {type === 'mindmap' && (
                                <div className="w-full h-full animate-fade-in flex flex-col relative overflow-hidden bg-white">
                                    <svg ref={visualizerRef} className="w-full h-full flex-1 touch-none" />
                                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/80 backdrop-blur-xl px-6 py-3 rounded-2xl border border-indigo-100 shadow-xl z-20">
                                        <button onClick={() => markmapInstance.current?.rescale(1.2)} className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600 font-black">+</button>
                                        <button onClick={() => markmapInstance.current?.rescale(0.8)} className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600 font-black">-</button>
                                        <button onClick={() => markmapInstance.current?.fit()} className="px-3 py-1 hover:bg-indigo-50 rounded-lg text-indigo-600 font-bold text-[10px] uppercase">Reset</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .markmap { width: 100%; height: 100%; background: white; }
                .markmap-node text { font-family: 'SamsungSharp', sans-serif !important; font-weight: 700 !important; font-size: 14px !important; fill: #1E1B4B !important; }
            `}</style>
        </div>
    );
};

export default StudyToolsModal;
