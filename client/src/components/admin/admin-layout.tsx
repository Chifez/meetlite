import React, { useState } from 'react';
import { AdminSidebar } from './admin-sidebar';
import AdminBreadcrumb from './admin-breadcrumb';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative flex flex-row bg-primary/10 lg:max-h-screen">
      <AdminSidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <div className="flex-1 flex flex-col min-w-0 scrollbar-hide lg:border lg:rounded-xl lg:m-2 lg:max-h-screen overflow-y-auto">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b p-4">
          <AdminBreadcrumb
            isMobileMenuOpen={mobileMenuOpen}
            setIsMobileMenuOpen={setMobileMenuOpen}
          />
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
