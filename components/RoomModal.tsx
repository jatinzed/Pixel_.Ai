import React, { useState, useEffect } from 'react';
import { CloseIcon, CopyIcon, CheckCircleIcon, PlusIcon } from './Icons';
import { generateRoomCode } from '../services/firebaseService';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (code?: string) => Promise<string>;
  onJoinRoom: (roomCode: string) => Promise<void>;
}

const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, onCreateRoom, onJoinRoom }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomCodeToJoin, setRoomCodeToJoin] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate code immediately on mount/open
  useEffect(() => {
    if (isOpen) {
        setGeneratedCode(generateRoomCode());
        setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    setIsLoading(true);
    setError(null);
    try {
        // Use the code user is already seeing
        await onCreateRoom(generatedCode);
        onClose();
    } catch (err: any) {
        console.error("Create room error:", err);
        setError(err.message || "Failed to create room.");
        setIsLoading(false);
    }
  };
  
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCodeToJoin.trim()) {
      setIsLoading(true);
      setError(null);
      try {
        await onJoinRoom(roomCodeToJoin.trim().toUpperCase());
        onClose();
        setRoomCodeToJoin('');
      } catch (err: any) {
        console.error("Join room error:", err);
        setError(err.message || "Failed to join room.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCopy = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleClose = () => {
    setRoomCodeToJoin('');
    setError(null);
    setIsLoading(false);
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Chat Rooms</h2>
          <button 
            onClick={handleClose} 
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close modal"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Custom Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setActiveTab('create'); setError(null); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'create' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Create New
            </button>
            <button
              onClick={() => { setActiveTab('join'); setError(null); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'join' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Join Existing
            </button>
        </div>

        {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
            </div>
        )}

        {activeTab === 'create' && (
          <div className="animate-fade-in">
             <div className="text-center mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Room Code</p>
                
                {/* Generated Code Display - ABOVE button */}
                <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-5 relative group mb-4">
                     <p className="text-4xl font-mono font-bold tracking-widest text-indigo-700 select-all">
                        {generatedCode}
                     </p>
                     <button 
                        onClick={handleCopy}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-indigo-300 hover:text-indigo-600 transition-colors"
                        title="Copy Code"
                     >
                        {copied ? <CheckCircleIcon className="w-6 h-6 text-green-500" /> : <CopyIcon className="w-6 h-6" />}
                     </button>
                </div>
                <p className="text-xs text-gray-400">This code is ready. Click below to start.</p>
             </div>

             <button
                onClick={handleCreate}
                disabled={isLoading}
                className="w-full bg-[#6A5BFF] text-white font-bold py-3.5 px-4 rounded-xl hover:bg-opacity-90 transition-all transform active:scale-[0.98] shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
             >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <>
                        <PlusIcon className="w-5 h-5" />
                        <span>Enter Room</span>
                    </>
                )}
             </button>
          </div>
        )}

        {activeTab === 'join' && (
          <form onSubmit={handleJoin} className="animate-fade-in">
            <div className="mb-6">
                 <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Enter Room Code</label>
                 <input
                  type="text"
                  value={roomCodeToJoin}
                  onChange={(e) => setRoomCodeToJoin(e.target.value.toUpperCase())}
                  placeholder="e.g. X7K9P2"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-center text-xl font-mono font-bold tracking-widest text-gray-800 placeholder-gray-300 outline-none transition-all uppercase"
                  disabled={isLoading}
                  autoFocus
                />
            </div>
            <button
              type="submit"
              className="w-full bg-gray-900 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-gray-800 transition-all transform active:scale-[0.98] disabled:bg-gray-300 disabled:scale-100"
              disabled={!roomCodeToJoin.trim() || isLoading}
            >
              {isLoading ? (
                   <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Joining...
                    </span>
              ) : 'Join Room'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default RoomModal;