import React from 'react';
import { CloseIcon } from './Icons';

interface NotepadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotepadModal: React.FC<NotepadModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Notepad</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close notepad"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div>
          <textarea
            className="w-full h-64 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none text-gray-800 bg-white"
            placeholder="Start writing your notes here..."
            aria-label="Notepad content"
          ></textarea>
        </div>
      </div>
    </div>
  );
};

export default NotepadModal;
