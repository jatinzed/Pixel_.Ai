
import React, { useState } from 'react';
import { CloseIcon, CopyIcon, CheckCircleIcon } from './Icons';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: () => string;
  onJoinRoom: (roomCode: string) => void;
}

const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, onCreateRoom, onJoinRoom }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomCode, setRoomCode] = useState('');
  const [newRoomCode, setNewRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCreate = () => {
    const code = onCreateRoom();
    setNewRoomCode(code);
    setCopied(false);
  };
  
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase());
      onClose();
    }
  };

  const handleCopy = () => {
    if (newRoomCode) {
      navigator.clipboard.writeText(newRoomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleClose = () => {
    setNewRoomCode(null);
    setRoomCode('');
    onClose();
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 transition-opacity"
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Chat Rooms</h2>
          <button 
            onClick={handleClose} 
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close modal"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'create' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Create Room
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'join' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Join Room
            </button>
          </div>
        </div>

        {activeTab === 'create' && (
          <div>
            {newRoomCode ? (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Your new room code is:</p>
                <div className="bg-gray-100 rounded-lg p-3 flex items-center justify-center space-x-4 mb-4">
                  <p className="text-2xl font-mono tracking-widest text-gray-800">{newRoomCode}</p>
                  <button onClick={handleCopy} className="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors">
                    {copied ? <CheckCircleIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-center text-gray-600 mb-4">Create a new private room to chat with friends.</p>
                <button
                  onClick={handleCreate}
                  className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Generate Room Code
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'join' && (
          <form onSubmit={handleJoin}>
            <p className="text-sm text-center text-gray-600 mb-4">Enter a room code to join an existing room.</p>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter code"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center font-mono tracking-widest uppercase"
            />
            <button
              type="submit"
              className="mt-4 w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
              disabled={!roomCode.trim()}
            >
              Join Room
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default RoomModal;
