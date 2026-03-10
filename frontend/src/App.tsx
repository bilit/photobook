import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import EditorPage from './pages/EditorPage';
import { getAuthStatus } from './api/client';
import type { AuthStatus } from './types';

function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuthStatus()
      .then(setAuth)
      .catch(() => setAuth({ loggedIn: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={auth?.loggedIn ? <Navigate to="/editor" replace /> : <LoginPage />}
        />
        <Route
          path="/editor"
          element={auth?.loggedIn ? <EditorPage user={auth.user!} /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
