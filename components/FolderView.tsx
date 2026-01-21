import React from 'react';
import { Folder, SavedItem } from '../types';
import { FolderIcon, TrashIcon, ChevronDoubleLeftIcon } from './Icons';
import MarkdownRenderer from './MarkdownRenderer';

interface FolderViewProps {
  folder: Folder;
  onClose: () => void;
  onDeleteItem: (itemId: string) => void;
}

const FolderView: React.FC<FolderViewProps> = ({ folder, onClose, onDeleteItem }) => {
  return (
    <div className="flex flex-col h-full bg-[#F9F9F9]">
      <header className="h-20 border-b border-gray-100 flex items-center bg-white px-8 sticky top-0 z-10">
        <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
          >
            <ChevronDoubleLeftIcon className="w-5 h-5" />
          </button>
          <div className="p-2 bg-indigo-50 rounded-xl">
            <FolderIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-xl font-black text-indigo-900 truncate">{folder.name}</h2>
          <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
            {folder.items.length} Snippets
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {folder.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-gray-100 mb-4 shadow-sm">
              <FolderIcon className="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-gray-400 font-bold">This folder is empty.</p>
            <p className="text-xs text-gray-300">Save AI responses here to build your study guide.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {folder.items.map((item) => (
              <div 
                key={item.id} 
                className="group bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Source: {item.sourceTitle}</p>
                    <p className="text-[10px] text-gray-300 font-bold mt-0.5">{new Date(item.timestamp).toLocaleDateString()}</p>
                  </div>
                  <button 
                    onClick={() => onDeleteItem(item.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    title="Delete item"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <MarkdownRenderer content={item.content} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderView;