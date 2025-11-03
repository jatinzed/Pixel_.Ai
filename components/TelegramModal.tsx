import React, { useState, useEffect } from 'react';
import { CloseIcon, PlusIcon, TrashIcon, UserAvatar } from './Icons';
import type { TelegramRecipient } from '../types';

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (token: string, recipients: TelegramRecipient[]) => void;
  initialToken?: string;
  initialRecipients?: TelegramRecipient[];
}

const TelegramModal: React.FC<TelegramModalProps> = ({ isOpen, onClose, onSave, initialToken = '', initialRecipients = [] }) => {
  const [token, setToken] = useState('');
  const [recipients, setRecipients] = useState<TelegramRecipient[]>([]);
  const [newName, setNewName] = useState('');
  const [newChatId, setNewChatId] = useState('');

  useEffect(() => {
    if (isOpen) {
        setToken(initialToken);
        setRecipients(initialRecipients);
        setNewName('');
        setNewChatId('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    const trimmedChatId = newChatId.trim();

    if (trimmedName && trimmedChatId) {
        setRecipients(prevRecipients => {
            if (prevRecipients.some(r => r.chatId === trimmedChatId)) {
                return prevRecipients; // Do not add duplicate chat IDs
            }
            return [...prevRecipients, { name: trimmedName, chatId: trimmedChatId }];
        });
        setNewName('');
        setNewChatId('');
    }
  };

  const handleRemoveRecipient = (chatId: string) => {
    setRecipients(prevRecipients => prevRecipients.filter(r => r.chatId !== chatId));
  };

  const handleSave = () => {
    if (token.trim()) {
      onSave(token.trim(), recipients);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 transform transition-all flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Telegram Configuration</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close modal"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-4 flex-1 overflow-y-auto pr-2 -mr-2">
            <p className="text-sm text-gray-600">
                Enter your Bot Token and add recipients. This is stored locally in your browser.
            </p>
            <div>
                <label htmlFor="bot-token" className="block text-sm font-medium text-gray-700">Bot Token</label>
                <input
                    type="text"
                    id="bot-token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
            </div>
            
            <div className="border-t pt-4">
                <h3 className="text-md font-semibold text-gray-700 mb-2">Recipients</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto mb-3 pr-2">
                    {recipients.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-2">No recipients added yet.</p>
                    ) : (
                        recipients.map(recipient => (
                            <div key={recipient.chatId} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <UserAvatar className="w-6 h-6"/>
                                    <div>
                                        <p className="font-medium text-sm text-gray-800">{recipient.name}</p>
                                        <p className="text-xs text-gray-500 font-mono">ID: {recipient.chatId}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleRemoveRecipient(recipient.chatId)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-full">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
                <form onSubmit={handleAddRecipient} className="bg-gray-100/70 p-3 rounded-lg space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Recipient Name"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <input
                            type="text"
                            value={newChatId}
                            onChange={(e) => setNewChatId(e.target.value)}
                            placeholder="Chat ID"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 text-sm font-semibold text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        disabled={!newName.trim() || !newChatId.trim()}
                    >
                        <PlusIcon className="w-4 h-4"/>
                        <span>Add Recipient</span>
                    </button>
                </form>
            </div>
        </div>
         <div className="mt-6">
            <button
              onClick={handleSave}
              className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
              disabled={!token.trim()}
            >
              Save & Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default TelegramModal;