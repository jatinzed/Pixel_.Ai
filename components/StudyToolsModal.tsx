import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, BrainIcon, ChartBarIcon, EyeIcon } from './Icons';
import { Folder } from '../types';
import { generateStudyMaterial } from '../services/geminiService';

interface StudyToolsModalProps {
    isOpen: boolean;
    onClose: () => void;
    folder: Folder;
    type: 'quiz' | 'flashcards' | 'mindmap';
}

const StudyToolsModal: React.FC<StudyToolsModalProps> = ({ isOpen, onClose, folder, type }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [quizIndex, setQuizIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [flashcardIndex, setFlashcardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    
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
                        setError("Failed to parse study material. Please try again.");
                    }
                })
                .catch(err => {
                    setError("Failed to generate study content.");
                })
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, folder, type]);

    useEffect(() => {
        if (type === 'mindmap' && data && visualizerRef.current && isOpen) {
            const initMarkmap = (retryCount = 0) => {
                const mm = (window as any).markmap;
                
                if (mm && mm.Transformer && mm.Markmap) {
                    try {
                        const transformer = new mm.Transformer();
                        const { root } = transformer.transform(data);
                        
                        while (visualizerRef.current?.firstChild) {
                            visualizerRef.current.removeChild(visualizerRef.current.firstChild);
                        }
                        
                        if (visualizerRef.current) {
                            // Ensure the container has dimensions
                            const svg = visualizerRef.current;
                            svg.style.width = '100%';
                            svg.style.height = '100%';

                            markmapInstance.current = mm.Markmap.create(svg, {
                                autoFit: true,
                                duration: 500,
                                paddingX: 32,
                                color: (node: any) => {
                                    const colors = ['#6A5BFF', '#818CF8', '#A5B4FC', '#C7D2FE'];
                                    return colors[Math.min(node.depth, colors.length - 1)];
                                }
                            }, root);

                            // Initial fit
                            setTimeout(() => {
                                if (markmapInstance.current) {
                                    markmapInstance.current.fit();
                                }
                            }, 300);

                            // Secondary fit to handle async font loading or layout shifts
                            setTimeout(() => {
                                if (markmapInstance.current) {
                                    markmapInstance.current.fit();
                                    markmapInstance.current.rescale(1.0);
                                }
                            }, 800);
                        }
                    } catch (err) {
                        console.error("Markmap Initialization Error:", err);
                        setError("Could not render the Knowledge Map structure.");
                    }
                } else if (retryCount < 8) {
                    setTimeout(() => initMarkmap(retryCount + 1), 250);
                } else {
                    console.error("Markmap globals not found after retries");
                    setError("Visualization library failed to load. Please refresh the page.");
                }
            };

            initMarkmap();
        }
        
        return () => {
            if (markmapInstance.current) {
                markmapInstance.current = null;
            }
        };
    }, [type, data, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
                <header className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                            {type === 'quiz' && <BrainIcon className="w-6 h-6 text-indigo-600" />}
                            {type === 'flashcards' && <ChartBarIcon className="w-6 h-6 text-green-600" />}
                            {type === 'mindmap' && <EyeIcon className="w-6 h-6 text-orange-600" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {type === 'quiz' ? 'Interactive Quiz' : type === 'flashcards' ? 'Smart Flashcards' : 'Knowledge Map'}
                            </h2>
                            <p className="text-xs text-indigo-500 font-bold uppercase tracking-widest">{folder.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {type === 'mindmap' && !isLoading && !error && (
                             <p className="hidden md:block text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-indigo-100 shadow-sm animate-pulse">
                                Click nodes to expand branches
                             </p>
                        )}
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-colors">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden p-0 flex flex-col items-center justify-center bg-[#F9FBFF]">
                    {isLoading ? (
                        <div className="text-center py-20 px-8">
                            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                            <p className="text-lg font-bold text-gray-700">Structuring your session...</p>
                            <p className="text-sm text-gray-400">Transforming {folder.items.length} notes into learning material.</p>
                        </div>
                    ) : error ? (
                        <div className="text-center text-red-500 p-10 max-w-md">
                            <p className="text-lg font-bold mb-4">{error}</p>
                            <button onClick={onClose} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full font-bold hover:bg-gray-200 transition-colors">Close Tool</button>
                        </div>
                    ) : (
                        <div className="w-full h-full relative flex flex-col">
                            {type === 'quiz' && data?.questions && (
                                <div className="max-w-2xl mx-auto w-full p-8 overflow-y-auto">
                                    {!quizCompleted ? (
                                        <div className="animate-fade-in">
                                            <div className="flex justify-between items-center mb-8">
                                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Question {quizIndex + 1} of {data.questions.length}</span>
                                                <span className="text-sm font-bold text-gray-700">Score: {score}</span>
                                            </div>
                                            <h3 className="text-2xl font-bold text-gray-800 mb-8">{data.questions[quizIndex].question}</h3>
                                            <div className="grid gap-4">
                                                {data.questions[quizIndex].options.map((opt: string, i: number) => (
                                                    <button 
                                                        key={i}
                                                        onClick={() => {
                                                            if (i === data.questions[quizIndex].correctAnswerIndex) setScore(score + 1);
                                                            if (quizIndex + 1 < data.questions.length) setQuizIndex(quizIndex + 1);
                                                            else setQuizCompleted(true);
                                                        }}
                                                        className="p-4 text-left border-2 border-gray-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all font-bold text-gray-700 bg-white shadow-sm"
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 animate-scale-in">
                                            <div className="text-6xl mb-6">🎓</div>
                                            <h3 className="text-3xl font-bold text-gray-800 mb-2">Quiz Completed!</h3>
                                            <p className="text-xl text-indigo-600 font-bold mb-8">Your Final Score: {score} / {data.questions.length}</p>
                                            <button onClick={onClose} className="px-10 py-4 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-200 transition-transform active:scale-95">Finish Session</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {type === 'flashcards' && data?.flashcards && (
                                <div className="max-w-md mx-auto w-full h-full flex flex-col p-8 overflow-y-auto">
                                    <div className="flex-1 flex items-center justify-center">
                                        <div 
                                            onClick={() => setIsFlipped(!isFlipped)}
                                            className={`relative w-full aspect-[3/2] cursor-pointer perspective-1000 group`}
                                        >
                                            <div className={`relative w-full h-full duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                                                {/* Front */}
                                                <div className="absolute inset-0 bg-white border-2 border-indigo-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center backface-hidden shadow-xl">
                                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest absolute top-6">Question</span>
                                                    <p className="text-xl font-bold text-gray-800 leading-relaxed">{data.flashcards[flashcardIndex].front}</p>
                                                    <span className="text-xs text-gray-300 absolute bottom-6">Tap to flip</span>
                                                </div>
                                                {/* Back */}
                                                <div className="absolute inset-0 bg-indigo-600 border-2 border-indigo-600 rounded-3xl p-8 flex flex-col items-center justify-center text-center rotate-y-180 backface-hidden shadow-xl">
                                                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest absolute top-6">Answer</span>
                                                    <p className="text-lg font-bold text-white leading-relaxed">{data.flashcards[flashcardIndex].back}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-8 flex items-center justify-between w-full">
                                        <button 
                                            disabled={flashcardIndex === 0}
                                            onClick={() => { setFlashcardIndex(flashcardIndex - 1); setIsFlipped(false); }}
                                            className="p-4 bg-white border border-gray-200 shadow-sm rounded-full disabled:opacity-30 hover:bg-gray-50 transition-colors"
                                        >
                                            <svg className="w-6 h-6 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                                        </button>
                                        <span className="font-black text-gray-400 text-sm tracking-widest">{flashcardIndex + 1} / {data.flashcards.length}</span>
                                        <button 
                                            disabled={flashcardIndex === data.flashcards.length - 1}
                                            onClick={() => { setFlashcardIndex(flashcardIndex + 1); setIsFlipped(false); }}
                                            className="p-4 bg-indigo-600 text-white rounded-full disabled:opacity-30 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {type === 'mindmap' && (
                                <div className="w-full h-full animate-fade-in flex flex-col relative overflow-hidden bg-white">
                                    <svg 
                                        ref={visualizerRef} 
                                        className="w-full h-full flex-1 touch-none block"
                                        style={{ width: '100%', height: '100%', minHeight: '500px' }}
                                    />
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-indigo-100 shadow-xl z-20">
                                        <button onClick={() => markmapInstance.current?.rescale(1.2)} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-indigo-600 font-bold" title="Zoom In">+</button>
                                        <div className="h-4 w-px bg-indigo-100"></div>
                                        <button onClick={() => markmapInstance.current?.rescale(0.8)} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-indigo-600 font-bold" title="Zoom Out">-</button>
                                        <div className="h-4 w-px bg-indigo-100"></div>
                                        <button onClick={() => markmapInstance.current?.fit()} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-indigo-600 text-lg" title="Fit to Screen">⛶</button>
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
                
                /* Markmap Styles */
                .markmap-node { cursor: pointer; }
                .markmap-node circle { stroke: #fff; stroke-width: 2.5px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }
                .markmap-node text { font-family: 'SamsungSharp', sans-serif !important; font-weight: 700 !important; font-size: 15px !important; fill: #1E1B4B !important; }
                .markmap-link { stroke-opacity: 0.4 !important; stroke-width: 2px !important; }
                .markmap-node-folded circle { fill: #F59E0B !important; stroke: #FFF !important; }
                .markmap-node-folded text { fill: #92400E !important; }
            `}</style>
        </div>
    );
};

export default StudyToolsModal;