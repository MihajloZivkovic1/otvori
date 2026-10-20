import { Route, Routes } from 'react-router';
import { MenuPage } from './pages/MenuPage';

export function App() {
  return (
    <Routes>
      {/* Dev / fallback form: the slug in the path, optionally with the table from the QR code. */}
      <Route path="/r/:slug/t/:table" element={<MenuPage />} />
      <Route path="/r/:slug/*" element={<MenuPage />} />
      {/* Production form: the restaurant comes from the host ({slug}.salveta.menu), the table from /t/<number>. */}
      <Route path="/t/:table" element={<MenuPage />} />
      <Route path="*" element={<MenuPage />} />
    </Routes>
  );
}
