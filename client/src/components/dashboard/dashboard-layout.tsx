import React from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background pb-16 pt-8 px-5 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">{children}</div>
    </div>
  );
}
