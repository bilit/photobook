import { useState } from 'react';
import { logout } from '../api/client';

interface Props {
  user: { displayName: string; email: string };
  bookTitle: string;
  onTitleChange: (title: string) => void;
  onGeneratePdf: () => void;
  generating: boolean;
  pageCount: number;
}

export default function Navbar({ user, bookTitle, onTitleChange, onGeneratePdf, generating, pageCount }: Props) {
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
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
      <span className="text-xl">📸</span>

      <div className="flex-1 flex items-center gap-2">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
            className="text-lg font-semibold border-b-2 border-blue-500 outline-none px-1 bg-transparent"
          />
        ) : (
          <button
            onClick={() => { setTitleDraft(bookTitle); setEditingTitle(true); }}
            className="text-lg font-semibold text-gray-800 hover:text-blue-600 transition-colors"
          >
            {bookTitle}
          </button>
        )}
        {!editingTitle && <span className="text-gray-400 text-sm">· {pageCount} page{pageCount !== 1 ? 's' : ''}</span>}
      </div>

      <button
        onClick={onGeneratePdf}
        disabled={generating || pageCount === 0}
        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
      >
        {generating ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Generating PDF...
          </>
        ) : (
          <>⬇ Download PDF</>
        )}
      </button>

      <div className="flex items-center gap-3 ml-2">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-700">{user.displayName}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-red-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
