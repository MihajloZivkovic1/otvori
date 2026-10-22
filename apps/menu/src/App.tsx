import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router';
import { MenuPage } from './pages/MenuPage';

// The order status page is only reached after sending an order: its own chunk.
const OrderPage = lazy(() => import('./pages/OrderPage').then((module) => ({ default: module.OrderPage })));
const order = (
  <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
    <OrderPage />
  </Suspense>
);

export function App() {
  return (
    <Routes>
      {/* Dev / fallback form: the slug in the path, optionally with the table from the QR code. */}
      <Route path="/r/:slug/t/:table" element={<MenuPage />} />
      <Route path="/r/:slug/order/:orderId" element={order} />
      <Route path="/r/:slug/*" element={<MenuPage />} />
      {/* Production form: the restaurant comes from the host ({slug}.salveta.menu), the table from /t/<number>. */}
      <Route path="/t/:table" element={<MenuPage />} />
      <Route path="/order/:orderId" element={order} />
      <Route path="*" element={<MenuPage />} />
    </Routes>
  );
}
