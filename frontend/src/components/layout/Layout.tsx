// frontend/src/components/layout/Layout.tsx
import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
      return;
    }

    document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_#f8fafc,_#f1f5f9_45%,_#e2e8f0)]">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:pl-0">
        {/* Header */}
        <Header onMenuToggle={() => setIsSidebarOpen((prev) => !prev)} />
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}