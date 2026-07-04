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
    <div className="relative flex flex-row bg-background lg:max-h-screen min-h-screen">
      <AdminSidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <div className="flex-1 flex flex-col min-w-0 scrollbar-hide lg:border-l lg:border-border lg:max-h-screen overflow-y-auto">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-6 py-3.5">
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
