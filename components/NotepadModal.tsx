import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, PlusIcon, TrashIcon, EditIcon, EyeIcon, DocumentTextIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, MenuIcon } from './Icons';
import { Note } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface NotepadModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onUpdateNotes: (notes: Note[]) => void;
}

const NotepadModal: React.FC<NotepadModalProps> = ({ isOpen, onClose, notes, onUpdateNotes }) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Local state for editing to prevent re-render glitches
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  
  // Ref for debouncing saves
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize: When modal opens
  useEffect(() => {
    if (isOpen) {
      if (!activeNoteId && notes.length > 0) {
        setActiveNoteId(notes[0].id);
      } else if (notes.length === 0) {
        const newNote: Note = {
            id: Date.now().toString(),
            title: 'Untitled Note',
            content: '',
            updatedAt: Date.now(),
        };
        onUpdateNotes([newNote]);
        setActiveNoteId(newNote.id);
      }
      // Reset sidebar visibility on open based on screen size
      setIsSidebarVisible(true);
    }
  }, [isOpen]);

  // Sync local state ONLY when the active note ID changes (navigation)
  useEffect(() => {
    const activeNote = notes.find(n => n.id === activeNoteId);
    if (activeNote) {
        setLocalTitle(activeNote.title);
        setLocalContent(activeNote.content);
    } else {
        setLocalTitle('');
        setLocalContent('');
    }
  }, [activeNoteId]);

  if (!isOpen) return null;

  // Helper to get notes with current edits applied immediately
  const getNotesWithCurrentEdits = () => {
    if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
    }

    if (!activeNoteId) return notes;
    
    return notes.map(n => 
      n.id === activeNoteId 
      ? { ...n, title: localTitle, content: localContent, updatedAt: Date.now() } 
      : n
    );
  };

  const handleCreateNote = () => {
    const currentNotes = getNotesWithCurrentEdits();
    
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '',
      updatedAt: Date.now(),
    };
    
    onUpdateNotes([newNote, ...currentNotes]);
    setActiveNoteId(newNote.id);
    setIsPreviewMode(false);
    
    // On mobile, keep sidebar open to see the new note in list, or close it to edit?
    // Usually user wants to edit immediately.
    if (window.innerWidth < 768) {
        setIsSidebarVisible(false);
    }
  };

  const handleDeleteNote = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    const currentNotes = getNotesWithCurrentEdits();
    const updatedNotes = currentNotes.filter(n => n.id !== noteId);
    onUpdateNotes(updatedNotes);
    
    if (activeNoteId === noteId) {
      setActiveNoteId(updatedNotes.length > 0 ? updatedNotes[0].id : null);
    }
  };

  const handleSwitchNote = (noteId: string) => {
    if (activeNoteId !== noteId) {
        if (activeNoteId) {
           const currentNotes = getNotesWithCurrentEdits();
           onUpdateNotes(currentNotes);
        }
        setActiveNoteId(noteId);
        setIsPreviewMode(false);
    }
    
    // Carousel Behavior: On mobile, slide to content view
    if (window.innerWidth < 768) {
        setIsSidebarVisible(false);
    }
  };

  const handleLocalChange = (field: 'title' | 'content', value: string) => {
    if (field === 'title') setLocalTitle(value);
    else setLocalContent(value);

    if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
        if (!activeNoteId) return;
        
        const titleToSave = field === 'title' ? value : localTitle;
        const contentToSave = field === 'content' ? value : localContent;

        const updatedNotes = notes.map(n => 
            n.id === activeNoteId 
            ? { ...n, title: titleToSave, content: contentToSave, updatedAt: Date.now() } 
            : n
        );
        onUpdateNotes(updatedNotes);
    }, 500);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4 md:p-8 transition-opacity"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex overflow-hidden ring-1 ring-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className={`${isSidebarVisible ? 'w-full md:w-80' : 'w-0'} bg-white border-r border-gray-100 flex flex-col transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 relative`}>
          <div className="p-5 flex items-center justify-between">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-indigo-50 rounded-lg">
                    <DocumentTextIcon className="w-5 h-5 text-[#6A5BFF]"/>
                 </div>
                 <h2 className="text-xl font-bold text-gray-800 tracking-tight">Notes</h2>
             </div>
             {/* Desktop Collapse Button */}
             <button 
                onClick={() => setIsSidebarVisible(false)}
                className="hidden md:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Collapse Sidebar"
             >
                <ChevronDoubleLeftIcon className="w-5 h-5" />
             </button>
              {/* Mobile Close Button (Top Right of Sidebar) */}
              <button 
                onClick={onClose}
                className="md:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                 <CloseIcon className="w-6 h-6" />
              </button>
          </div>
          
          <div className="px-4 pb-4">
            <button 
                onClick={handleCreateNote}
                className="w-full py-3 px-4 bg-[#6A5BFF] text-white rounded-xl hover:bg-[#5a4be0] transition-colors flex items-center justify-center gap-2 font-semibold shadow-md shadow-indigo-200"
            >
                <PlusIcon className="w-5 h-5" />
                <span>New Note</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {notes.length === 0 ? (
               <div className="text-center py-10 text-gray-400 text-sm">
                  No notes yet.
               </div>
            ) : (
                notes.map(note => (
                  <div 
                    key={note.id}
                    onClick={() => handleSwitchNote(note.id)}
                    className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${
                        activeNoteId === note.id 
                        ? 'bg-indigo-50 border-indigo-100 shadow-sm' 
                        : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'
                    }`}
                  >
                    <h3 className={`text-sm font-semibold truncate mb-1 ${activeNoteId === note.id ? 'text-[#6A5BFF]' : 'text-gray-700'}`}>
                        {note.title.trim() || 'Untitled Note'}
                    </h3>
                    <p className={`text-xs truncate font-medium ${activeNoteId === note.id ? 'text-indigo-400' : 'text-gray-400'}`}>
                        {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    
                    <button 
                      onClick={(e) => handleDeleteNote(e, note.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete note"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col bg-white min-w-0 relative">
          {activeNoteId ? (
            <>
              {/* Toolbar / Header */}
              <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white z-10">
                 <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Toggle Sidebar Button */}
                    <button 
                        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                        className={`p-2 -ml-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ${isSidebarVisible ? 'md:hidden' : 'flex'}`}
                        title={isSidebarVisible ? "Hide List" : "Show List"}
                    >
                        {isSidebarVisible ? (
                             /* On Mobile, if Sidebar is visible, this button is hidden because Sidebar covers it */
                             /* So this case actually only handles Desktop when Sidebar is Visible but we want to hide it? No, we hide this button on Desktop if visible to avoid clutter, user uses sidebar close button */
                             /* But wait, on mobile, sidebar covers everything. So this button is only reachable if sidebar is HIDDEN. */
                             <ChevronDoubleLeftIcon className="w-5 h-5" />
                        ) : (
                             /* Sidebar Hidden: Show 'Back to List' (Mobile) or 'Expand' (Desktop) */
                             <div className="flex items-center gap-2">
                                <ChevronDoubleRightIcon className="w-5 h-5 hidden md:block" />
                                <div className="md:hidden flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                   <ChevronDoubleLeftIcon className="w-4 h-4" />
                                   <span>List</span>
                                </div>
                             </div>
                        )}
                    </button>
                    
                    {/* Title Input */}
                    <input 
                        type="text"
                        value={localTitle}
                        onChange={(e) => handleLocalChange('title', e.target.value)}
                        placeholder="Untitled Note"
                        className="text-xl font-bold text-gray-800 placeholder-gray-300 border-none focus:ring-0 bg-transparent w-full truncate"
                    />
                 </div>

                 <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="bg-gray-100 p-1 rounded-lg flex">
                        <button
                            onClick={() => setIsPreviewMode(false)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${!isPreviewMode ? 'bg-white shadow-sm text-[#6A5BFF]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <EditIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                            onClick={() => setIsPreviewMode(true)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${isPreviewMode ? 'bg-white shadow-sm text-[#6A5BFF]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <EyeIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Preview</span>
                        </button>
                    </div>
                    <div className="h-6 w-px bg-gray-200 mx-2"></div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Close"
                    >
                        <CloseIcon className="w-6 h-6" />
                    </button>
                 </div>
              </div>

              {/* Editor/Preview Content */}
              <div className="flex-1 overflow-y-auto bg-white">
                 {isPreviewMode ? (
                     <div className="max-w-4xl mx-auto p-8 prose prose-indigo prose-lg bg-white">
                        {localContent.trim() ? (
                            <MarkdownRenderer content={localContent} />
                        ) : (
                            <p className="text-gray-300 italic text-center mt-10">Nothing to preview yet.</p>
                        )}
                     </div>
                 ) : (
                    <textarea
                        value={localContent}
                        onChange={(e) => handleLocalChange('content', e.target.value)}
                        className="w-full h-full resize-none border-none focus:ring-0 text-gray-700 text-lg leading-relaxed p-8 placeholder-gray-300 bg-white"
                        placeholder="Start typing your note here... Markdown is supported."
                        spellCheck={false}
                    />
                 )}
              </div>
            </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 bg-white">
                <div className="bg-gray-50 p-6 rounded-full mb-4">
                    <DocumentTextIcon className="w-12 h-12 text-gray-300" />
                </div>
                <p className="text-lg font-medium text-gray-500">Select a note to view</p>
                <p className="text-sm mt-2 text-gray-400">or create a new one.</p>
                {/* Mobile: If no note selected, user sees sidebar anyway (because isSidebarVisible is true on init). 
                    If they manage to get here, provide a button to open sidebar. */}
                 <button 
                    onClick={() => setIsSidebarVisible(true)}
                    className="mt-4 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    View Notes List
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotepadModal;