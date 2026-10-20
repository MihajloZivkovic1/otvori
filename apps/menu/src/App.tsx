import { Route, Routes } from 'react-router';
import { MenuPage } from './pages/MenuPage';

export function App() {
  return (
    <Routes>
      {/* Dev / fallback form: the slug in the path. */}
      <Route path="/r/:slug/*" element={<MenuPage />} />
      {/* Production form: the restaurant comes from the host ({slug}.salveta.menu). */}
      <Route path="*" element={<MenuPage />} />
    </Routes>
  );
}
