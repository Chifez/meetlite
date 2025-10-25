import React from 'react';

export default function MeetingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-page py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-10">{children}</div>
    </div>
  );
}
