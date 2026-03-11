import { useState } from 'react';
import { logout } from '../api/client';

interface Props {
  user: { displayName: string; email: string };
  bookTitle: string;
  onTitleChange: (title: string) => void;
  onGeneratePdf: () => void;
  generating: boolean;
  pageCount: number;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export default function Navbar({ user, bookTitle, onTitleChange, onGeneratePdf, generating, pageCount, onToggleSidebar, sidebarOpen }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(bookTitle);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const commitTitle = () => {
    onTitleChange(titleDraft.trim() || 'My Photobook');
    setEditingTitle(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-4">
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      )}

      <span className="text-xl flex-shrink-0">📸</span>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
            className="text-base sm:text-lg font-semibold border-b-2 border-blue-500 outline-none px-1 bg-transparent w-full"
          />
        ) : (
          <button
            onClick={() => { setTitleDraft(bookTitle); setEditingTitle(true); }}
            className="text-base sm:text-lg font-semibold text-gray-800 hover:text-blue-600 transition-colors truncate max-w-[120px] sm:max-w-xs"
          >
            {bookTitle}
          </button>
        )}
        {!editingTitle && <span className="text-gray-400 text-sm hidden sm:inline">· {pageCount} page{pageCount !== 1 ? 's' : ''}</span>}
      </div>

      <button
        onClick={onGeneratePdf}
        disabled={generating || pageCount === 0}
        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-colors text-sm flex-shrink-0"
      >
        {generating ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="hidden sm:inline">Generating PDF...</span>
          </>
        ) : (
          <>
            <span>⬇</span>
            <span className="hidden sm:inline">Download PDF</span>
          </>
        )}
      </button>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-700">{user.displayName}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-red-500 transition-colors whitespace-nowrap"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
