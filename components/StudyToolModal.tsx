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

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-tight">
              {type === 'flashcards' ? 'Flashcard Deck' : 'Practice Quiz'}
            </h2>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{folderName}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 text-gray-400">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-8 min-h-[400px] flex flex-col">
          {!showResult ? (
            <>
              {/* Progress Bar */}
              <div className="w-full bg-gray-100 h-2 rounded-full mb-8 overflow-hidden">
                <div 
                  className="h-full bg-[#6A5BFF] transition-all duration-500"
                  style={{ width: `${((currentIndex + 1) / data.length) * 100}%` }}
                />
              </div>

              <div className="flex-1 flex flex-col justify-center">
                {type === 'flashcards' ? (
                  /* Flashcard Content */
                  <div 
                    className="relative w-full h-64 perspective-1000 cursor-pointer group"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                      {/* Front */}
                      <div className="absolute inset-0 bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-8 flex items-center justify-center backface-hidden shadow-inner">
                        <p className="text-xl font-bold text-center text-gray-800">{(data[currentIndex] as Flashcard).question}</p>
                        <p className="absolute bottom-4 text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Click to reveal answer</p>
                      </div>
                      {/* Back */}
                      <div className="absolute inset-0 bg-white border-2 border-green-100 rounded-3xl p-8 flex items-center justify-center backface-hidden rotate-y-180 shadow-inner">
                        <p className="text-lg font-medium text-center text-gray-700 leading-relaxed">{(data[currentIndex] as Flashcard).answer}</p>
                        <p className="absolute bottom-4 text-[10px] font-bold text-green-300 uppercase tracking-widest">Click to flip back</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Quiz Content */
                  <div className="animate-fade-in">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">{(data[currentIndex] as QuizQuestion).question}</h3>
                    <div className="space-y-3">
                      {(data[currentIndex] as QuizQuestion).options.map((option, i) => {
                        let bgColor = 'bg-gray-50 hover:bg-indigo-50 border-gray-100';
                        if (isAnswered) {
                            if (i === (data[currentIndex] as QuizQuestion).correctIndex) bgColor = 'bg-green-100 border-green-200 text-green-800';
                            else if (i === selectedOption) bgColor = 'bg-red-100 border-red-200 text-red-800';
                            else bgColor = 'bg-gray-50 opacity-50 border-gray-100';
                        }
                        return (
                          <button
                            key={i}
                            onClick={() => handleOptionSelect(i)}
                            disabled={isAnswered}
                            className={`w-full p-4 text-left rounded-2xl border-2 transition-all font-semibold ${bgColor}`}
                          >
                            <span className="inline-block w-6 h-6 rounded-full bg-white text-center text-xs leading-6 mr-3 shadow-sm border border-gray-100">
                                {String.fromCharCode(65 + i)}
                            </span>
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-400">Question {currentIndex + 1} of {data.length}</p>
                <button
                  onClick={handleNext}
                  disabled={type === 'quiz' && !isAnswered}
                  className="bg-[#6A5BFF] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {currentIndex === data.length - 1 ? 'Finish' : 'Next'}
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            /* Result Screen */
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-bounce-in">
                <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                    <CheckCircleIcon className="w-16 h-16 text-indigo-500" />
                </div>
                <h3 className="text-3xl font-extrabold text-gray-800 mb-2">Great Job!</h3>
                <p className="text-gray-500 mb-8">You've completed the study session for <br/><span className="text-indigo-600 font-bold">{folderName}</span></p>
                
                {type === 'quiz' && (
                    <div className="bg-gray-50 rounded-3xl px-8 py-4 mb-8">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Your Score</p>
                        <p className="text-4xl font-extrabold text-indigo-600">{score} <span className="text-gray-300 text-xl">/ {data.length}</span></p>
                    </div>
                )}

                <div className="flex gap-4 w-full">
                    <button 
                        onClick={reset}
                        className="flex-1 py-4 border-2 border-gray-100 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                    >
                        <RegenerateIcon className="w-5 h-5" />
                        Restart
                    </button>
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
                    >
                        Done
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
        @keyframes bounce-in {
            0% { transform: scale(0.9); opacity: 0; }
            70% { transform: scale(1.05); }
            100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in { animation: bounce-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default StudyToolModal;