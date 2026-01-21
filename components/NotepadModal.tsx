import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, PlusIcon, TrashIcon, EditIcon, EyeIcon, DocumentTextIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, FolderPlusIcon, LibraryIcon } from './Icons';
import { Note, TopicFolder } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface NotepadModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onUpdateNotes: (notes: Note[]) => void;
  folders: TopicFolder[];
  onUpdateFolders: (folders: TopicFolder[]) => void;
}

const NotepadModal: React.FC<NotepadModalProps> = ({ isOpen, onClose, notes, onUpdateNotes, folders, onUpdateFolders }) => {
  const [view, setView] = useState<'notes' | 'library'>('notes');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (view === 'notes' && !activeNoteId && notes.length > 0) setActiveNoteId(notes[0].id);
      if (view === 'library' && !activeFolderId && folders.length > 0) setActiveFolderId(folders[0].id);
      setIsSidebarVisible(true);
    }
  }, [isOpen, view]);

  useEffect(() => {
    const activeNote = notes.find(n => n.id === activeNoteId);
    if (activeNote) {
        setLocalTitle(activeNote.title);
        setLocalContent(activeNote.content);
    }
  }, [activeNoteId]);

  if (!isOpen) return null;

  const handleCreateNote = () => {
    const newNote: Note = { id: Date.now().toString(), title: 'Untitled Note', content: '', updatedAt: Date.now() };
    onUpdateNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
    setIsPreviewMode(false);
    if (window.innerWidth < 768) setIsSidebarVisible(false);
  };

  const handleDeleteNote = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    const updated = notes.filter(n => n.id !== noteId);
    onUpdateNotes(updated);
    if (activeNoteId === noteId) setActiveNoteId(updated.length > 0 ? updated[0].id : null);
  };

  const handleDeleteFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    const updated = folders.filter(f => f.id !== folderId);
    onUpdateFolders(updated);
    if (activeFolderId === folderId) setActiveFolderId(updated.length > 0 ? updated[0].id : null);
  };

  const handleLocalChange = (field: 'title' | 'content', value: string) => {
    if (field === 'title') setLocalTitle(value); else setLocalContent(value);
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
        if (!activeNoteId) return;
        const updated = notes.map(n => n.id === activeNoteId ? { ...n, title: field === 'title' ? value : localTitle, content: field === 'content' ? value : localContent, updatedAt: Date.now() } : n);
        onUpdateNotes(updated);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4 md:p-8" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className={`${isSidebarVisible ? 'w-full md:w-80' : 'w-0'} bg-white border-r border-gray-100 flex flex-col transition-all duration-300 relative overflow-hidden flex-shrink-0`}>
          <div className="p-4 flex gap-1 bg-gray-50/50">
            <button onClick={() => setView('notes')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === 'notes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>NOTES</button>
            <button onClick={() => setView('library')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === 'library' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>TOPICS</button>
          </div>
          
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">{view === 'notes' ? 'My Notes' : 'Topic Folders'}</h2>
            <button onClick={() => setIsSidebarVisible(false)} className="hidden md:block text-gray-400 hover:text-gray-600"><ChevronDoubleLeftIcon className="w-5 h-5"/></button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {view === 'notes' ? (
              <>
                <button onClick={handleCreateNote} className="w-full py-3 mb-2 bg-[#6A5BFF] text-white rounded-xl flex items-center justify-center gap-2 font-bold shadow-md shadow-indigo-100 hover:bg-opacity-90"><PlusIcon className="w-5 h-5"/> New Note</button>
                {notes.map(note => (
                  <div key={note.id} onClick={() => { setActiveNoteId(note.id); if (window.innerWidth < 768) setIsSidebarVisible(false); }} className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${activeNoteId === note.id ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-transparent hover:bg-gray-50'}`}>
                    <h3 className={`text-sm font-semibold truncate ${activeNoteId === note.id ? 'text-[#6A5BFF]' : 'text-gray-700'}`}>{note.title || 'Untitled'}</h3>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(note.updatedAt).toLocaleDateString()}</p>
                    <button onClick={e => handleDeleteNote(e, note.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"><TrashIcon className="w-4 h-4"/></button>
                  </div>
                ))}
              </>
            ) : (
                folders.map(folder => (
                  <div key={folder.id} onClick={() => { setActiveFolderId(folder.id); if (window.innerWidth < 768) setIsSidebarVisible(false); }} className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${activeFolderId === folder.id ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-transparent hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                        <FolderPlusIcon className={`w-5 h-5 ${activeFolderId === folder.id ? 'text-indigo-600' : 'text-gray-400'}`}/>
                        <div className="min-w-0">
                            <h3 className={`text-sm font-semibold truncate ${activeFolderId === folder.id ? 'text-indigo-700' : 'text-gray-700'}`}>{folder.name}</h3>
                            <p className="text-[10px] text-gray-400">{folder.snippets.length} snippets</p>
                        </div>
                    </div>
                    <button onClick={e => handleDeleteFolder(e, folder.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"><TrashIcon className="w-4 h-4"/></button>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative">
            <header className="h-16 px-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {!isSidebarVisible && <button onClick={() => setIsSidebarVisible(true)} className="p-2 -ml-2 text-gray-400 hover:text-indigo-600"><ChevronDoubleRightIcon className="w-5 h-5"/></button>}
                    {view === 'notes' ? (
                        <input type="text" value={localTitle} onChange={e => handleLocalChange('title', e.target.value)} className="text-xl font-bold text-gray-800 bg-transparent border-none focus:ring-0 w-full" placeholder="Title..."/>
                    ) : (
                        <h2 className="text-xl font-bold text-gray-800">{folders.find(f => f.id === activeFolderId)?.name || 'Study Library'}</h2>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    {view === 'notes' && activeNoteId && (
                        <div className="bg-gray-100 p-1 rounded-lg flex">
                            <button onClick={() => setIsPreviewMode(false)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isPreviewMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>EDIT</button>
                            <button onClick={() => setIsPreviewMode(true)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isPreviewMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>PREVIEW</button>
                        </div>
                    )}
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600"><CloseIcon className="w-6 h-6"/></button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                {view === 'notes' ? (
                    activeNoteId ? (
                        isPreviewMode ? <div className="p-8 prose prose-indigo max-w-none"><MarkdownRenderer content={localContent}/></div> :
                        <textarea value={localContent} onChange={e => handleLocalChange('content', e.target.value)} className="w-full h-full p-8 text-lg border-none focus:ring-0 placeholder-gray-300 resize-none" placeholder="Start typing..."/>
                    ) : <EmptyState icon={<DocumentTextIcon className="w-12 h-12"/>} text="Select a note to begin"/>
                ) : (
                    activeFolderId ? (
                        <div className="p-6 space-y-6 max-w-4xl mx-auto">
                            {folders.find(f => f.id === activeFolderId)?.snippets.map(s => (
                                <div key={s.id} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 relative group shadow-sm">
                                    <div className="prose prose-sm"><MarkdownRenderer content={s.content}/></div>
                                    <div className="mt-4 flex items-center justify-between border-t border-gray-200/50 pt-3">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{new Date(s.timestamp).toLocaleString()}</p>
                                        <button onClick={() => {
                                            const folder = folders.find(f => f.id === activeFolderId);
                                            if (folder) {
                                                const updated = folders.map(f => f.id === activeFolderId ? { ...f, snippets: f.snippets.filter(snip => snip.id !== s.id) } : f);
                                                onUpdateFolders(updated);
                                            }
                                        }} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                            {folders.find(f => f.id === activeFolderId)?.snippets.length === 0 && <p className="text-center text-gray-400 py-20 italic">No saved content in this topic yet.</p>}
                        </div>
                    ) : <EmptyState icon={<LibraryIcon className="w-12 h-12"/>} text="Select a topic to view its content"/>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ icon, text }: { icon: React.ReactNode, text: string }) => (
    <div className="h-full flex flex-col items-center justify-center text-gray-300">
        <div className="mb-4">{icon}</div>
        <p className="text-lg font-bold">{text}</p>
    </div>
);

export default NotepadModal;