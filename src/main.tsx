import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminPortal from './AdminPortal.tsx';
import './index.css';

function isStandaloneAdminUrl(): boolean {
  if ((window as any).__LOOTIFY_ADMIN_PAGE__ === true) return true;
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  if (
    path.endsWith('/admin') ||
    path.endsWith('/admin.html') ||
    path.endsWith('/admin-panel') ||
    path.endsWith('/admin-panel.html')
  ) {
    return true;
  }
  const hash = window.location.hash.toLowerCase();
  if (hash === '#/admin' || hash === '#admin' || hash === '#/admin-panel') {
    return true;
  }
  const search = new URLSearchParams(window.location.search);
  if (search.get('portal') === 'admin') {
    return true;
  }
  return false;
}

function RootRouter() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(isStandaloneAdminUrl);

  useEffect(() => {
    const syncRoute = () => setIsAdminRoute(isStandaloneAdminUrl());
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  if (isAdminRoute) {
    return <AdminPortal />;
  }
  return <App />;
}

createRoot(document.getElementById('root')!).render(<RootRouter />);
