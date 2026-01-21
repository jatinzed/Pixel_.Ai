import React, { useState } from 'react';
import { CloseIcon, FolderIcon, PlusIcon, FolderPlusIcon } from './Icons';
import { Folder } from '../types';

interface AddToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onConfirm: (folderName: string) => void;
}

const AddToFolderModal: React.FC<AddToFolderModalProps> = ({ isOpen, onClose, folders, onConfirm }) => {
  const [newFolderName, setNewFolderName] = useState('');

  if (!isOpen) return null;

  const handleSelectExisting = (name: string) => {
    onConfirm(name);
    onClose();
  };

  const handleCreateNew = () => {
    if (newFolderName.trim()) {
      onConfirm(newFolderName.trim());
      setNewFolderName('');
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <FolderPlusIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-indigo-900">Save to Folder</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Select Existing</p>
          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto mb-6 pr-2 scrollbar-hide">
            {folders.length > 0 ? folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleSelectExisting(folder.name)}
                className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-left group"
              >
                <FolderIcon className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600" />
                <span className="font-bold text-gray-700">{folder.name}</span>
                <span className="ml-auto text-[10px] font-black text-gray-300 uppercase">{folder.items.length} items</span>
              </button>
            )) : (
              <p className="text-sm text-gray-400 italic py-2">No folders yet. Create your first one below!</p>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Or Create New</p>
            <div className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-indigo-300 focus-within:bg-white transition-all">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name (e.g. Physics)"
                className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 text-sm font-bold text-indigo-900 placeholder-indigo-200"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
              />
              <button
                onClick={handleCreateNew}
                disabled={!newFolderName.trim()}
                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-200 transition-all shadow-lg shadow-indigo-100"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddToFolderModal;