import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { WheelPlayground } from '@/pages/WheelPlayground';
import { AdminPage } from '@/pages/AdminPage';
import { GamePage } from '@/pages/GamePage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GamePage />} />
        <Route path="/wheel" element={<WheelPlayground />} />
        <Route path="/admin/*" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
