
import React, { useState } from 'react';
import { CloseIcon, ArrowRightIcon, CheckCircleIcon, RegenerateIcon } from './Icons';
import { Flashcard, QuizQuestion } from '../types';

interface StudyToolModalProps {
  type: 'flashcards' | 'quiz';
  data: any[];
  onClose: () => void;
  folderName: string;
}

const StudyToolModal: React.FC<StudyToolModalProps> = ({ type, data, onClose, folderName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const handleNext = () => {
    if (currentIndex < data.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setShowResult(true);
    }
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === (data[currentIndex] as QuizQuestion).correctIndex) {
      setScore(score + 1);
    }
  };

  const reset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setShowResult(false);
  };

  const progress = ((currentIndex + (isAnswered || type === 'flashcards' ? 1 : 0)) / data.length) * 100;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden transform transition-all animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${type === 'flashcards' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                {type === 'flashcards' ? '🗂️' : '📝'}
            </div>
            <div>
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter leading-none mb-1">
                {type === 'flashcards' ? 'Flashcards' : 'Knowledge Quiz'}
                </h2>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{folderName}</p>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-gray-50 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-8 min-h-[440px] flex flex-col">
          {!showResult ? (
            <>
              {/* Progress Tracker */}
              <div className="flex items-center gap-4 mb-8">
                 <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-700 ease-out ${type === 'flashcards' ? 'bg-amber-400' : 'bg-[#6A5BFF]'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-[11px] font-black text-gray-400 whitespace-nowrap">
                    {currentIndex + 1} / {data.length}
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                {type === 'flashcards' ? (
                  /* --- FLASHCARD VIEW --- */
                  <div 
                    className="relative w-full h-72 perspective-1000 cursor-pointer group"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                      <div className="absolute inset-0 bg-amber-50 border-2 border-amber-100 rounded-[32px] p-10 flex flex-col items-center justify-center backface-hidden shadow-inner overflow-y-auto">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-4">Question</span>
                        <p className="text-2xl font-black text-center text-gray-800 leading-tight">{(data[currentIndex] as Flashcard).question}</p>
                        <div className="absolute bottom-6 flex items-center gap-2 text-[10px] font-black text-amber-300 uppercase tracking-widest">
                            <span>Tap to reveal answer</span>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-white border-2 border-green-100 rounded-[32px] p-10 flex flex-col items-center justify-center backface-hidden rotate-y-180 shadow-inner overflow-y-auto">
                        <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] mb-4">The Answer</span>
                        <p className="text-xl font-bold text-center text-gray-700 leading-relaxed">{(data[currentIndex] as Flashcard).answer}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* --- QUIZ VIEW --- */
                  <div className="animate-fade-in-up">
                    <h3 className="text-2xl font-black text-gray-800 mb-8 leading-tight">{(data[currentIndex] as QuizQuestion).question}</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {(data[currentIndex] as QuizQuestion).options.map((option, i) => {
                        let stateClass = 'bg-gray-50 border-gray-100 hover:border-indigo-200 hover:bg-white text-gray-700';
                        let icon = <span className="text-xs font-black text-gray-300">{String.fromCharCode(65 + i)}</span>;

                        if (isAnswered) {
                            if (i === (data[currentIndex] as QuizQuestion).correctIndex) {
                                stateClass = 'bg-green-50 border-green-400 text-green-800 shadow-lg shadow-green-100';
                                icon = <span className="text-xs">✅</span>;
                            } else if (i === selectedOption) {
                                stateClass = 'bg-red-50 border-red-400 text-red-800';
                                icon = <span className="text-xs">❌</span>;
                            } else {
                                stateClass = 'bg-gray-50 border-gray-100 opacity-40 text-gray-400';
                            }
                        }

                        return (
                          <button
                            key={i}
                            onClick={() => handleOptionSelect(i)}
                            disabled={isAnswered}
                            className={`group w-full p-5 text-left rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${stateClass}`}
                          >
                            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-inherit">
                                {icon}
                            </div>
                            <span className="font-bold text-base">{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-10 flex items-center justify-between">
                <div>
                   {type === 'quiz' && isAnswered && (
                       <p className={`text-sm font-black uppercase tracking-widest ${selectedOption === (data[currentIndex] as QuizQuestion).correctIndex ? 'text-green-500' : 'text-red-500'}`}>
                           {selectedOption === (data[currentIndex] as QuizQuestion).correctIndex ? 'Correct!' : 'Incorrect'}
                       </p>
                   )}
                </div>
                <button
                  onClick={handleNext}
                  disabled={type === 'quiz' && !isAnswered}
                  className="bg-[#6A5BFF] text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 uppercase tracking-tighter"
                >
                  {currentIndex === data.length - 1 ? 'See Score' : 'Next Item'}
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            /* --- RESULTS VIEW --- */
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-zoom-in">
                <div className="relative mb-8">
                    <svg className="w-32 h-32 transform -rotate-90">
                        <circle className="text-gray-100" strokeWidth="8" stroke="currentColor" fill="transparent" r="58" cx="64" cy="64" />
                        <circle className="text-indigo-500" strokeWidth="8" strokeDasharray={58 * 2 * Math.PI} strokeDashoffset={58 * 2 * Math.PI * (1 - score / data.length)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="58" cx="64" cy="64" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black text-gray-800">{Math.round((score / data.length) * 100)}%</span>
                    </div>
                </div>

                <h3 className="text-3xl font-black text-gray-800 mb-2 uppercase tracking-tight">Session Complete</h3>
                <p className="text-gray-500 mb-10 max-w-[280px]">Great job practicing <span className="text-indigo-600 font-black">{folderName}</span>.</p>
                
                <div className="bg-indigo-50/50 rounded-3xl p-6 w-full flex justify-around mb-10 border border-indigo-50 shadow-inner">
                    <div className="text-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Final Score</p>
                        <p className="text-2xl font-black text-indigo-600">{score} / {data.length}</p>
                    </div>
                    <div className="w-px bg-indigo-100 h-10 self-center"></div>
                    <div className="text-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Items Mastered</p>
                        <p className="text-2xl font-black text-green-500">{score}</p>
                    </div>
                </div>

                <div className="flex gap-4 w-full">
                    <button 
                        onClick={reset}
                        className="flex-1 py-5 border-2 border-gray-100 rounded-2xl font-black text-gray-500 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                    >
                        <RegenerateIcon className="w-4 h-4" />
                        Retake
                    </button>
                    <button 
                        onClick={onClose}
                        className="flex-1 py-5 bg-gray-900 text-white rounded-2xl font-black hover:bg-gray-800 transition-all uppercase text-xs tracking-widest shadow-xl shadow-gray-200"
                    >
                        Close Study
                    </button>
                </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
        
        @keyframes scale-up {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-up { animation: scale-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        
        @keyframes zoom-in {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
        }
        .animate-zoom-in { animation: zoom-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
    </div>
  );
};

export default StudyToolModal;
