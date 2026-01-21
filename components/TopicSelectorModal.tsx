import React, { useState } from 'react';
import { CloseIcon, PlusIcon, FolderPlusIcon } from './Icons';
import { TopicFolder } from '../types';

interface TopicSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: TopicFolder[];
  onSaveToTopic: (folderId: string) => void;
  onCreateAndSave: (name: string) => void;
}

const TopicSelectorModal: React.FC<TopicSelectorModalProps> = ({ isOpen, onClose, folders, onSaveToTopic, onCreateAndSave }) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(folders.length === 0);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateAndSave(newFolderName.trim());
      setNewFolderName('');
      setShowCreateForm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Save to Topic</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-400">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {!showCreateForm ? (
          <div className="space-y-2">
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => onSaveToTopic(folder.id)}
                  className="w-full text-left p-3 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-100 transition-all flex items-center gap-3 group"
                >
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100">
                    <FolderPlusIcon className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-gray-700">{folder.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-200 transition-all font-medium"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Create New Topic</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Topic Name</label>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="e.g. Quantum Physics"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              {folders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 py-3 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-[2] py-3 bg-[#6A5BFF] text-white font-bold rounded-xl hover:bg-opacity-90 shadow-lg shadow-indigo-100 transition-all"
              >
                Create & Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TopicSelectorModal;