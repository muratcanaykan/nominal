import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { RoomRoute } from './lib/RoomRoute';
import { Hub } from './pages/Hub';
import { Landing } from './pages/Landing';
import { CabinPage, CmoRedirect, TabletPage, WatchPage } from './pages/ScreenPages';
import './styles/base.css';
import './styles/theme.css';
import './styles/app.css';

function NotFound() {
  return (
    <div className="page">
      <div className="gate">
        <h1>Page not found</h1>
        <Link className="btn-secondary" to="/">
          Back to start
        </Link>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/r/:roomId" element={<RoomRoute><Hub /></RoomRoute>} />
        <Route path="/r/:roomId/watch/:astronautId" element={<RoomRoute><WatchPage /></RoomRoute>} />
        <Route path="/r/:roomId/cabin" element={<RoomRoute><CabinPage /></RoomRoute>} />
        <Route path="/r/:roomId/tablet/:astronautId" element={<RoomRoute><TabletPage /></RoomRoute>} />
        <Route path="/r/:roomId/cmo" element={<RoomRoute><CmoRedirect /></RoomRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
