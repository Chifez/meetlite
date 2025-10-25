import React from 'react';

interface RemoteCursorProps {
  userName: string;
  userColor: string;
  x: number;
  y: number;
  isVisible: boolean;
}

export const RemoteCursor: React.FC<RemoteCursorProps> = ({
  userName,
  userColor,
  x,
  y,
  isVisible,
}) => {
  if (!isVisible || x < 0 || y < 0) {
    return null;
  }

  return (
    <div
      className="absolute pointer-events-none transition-all duration-100 ease-out z-50"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {/* Cursor line */}
      <div
        className="w-0.5 h-5 animate-pulse"
        style={{
          backgroundColor: userColor,
        }}
      />

      {/* User label */}
      <div
        className="absolute -top-6 left-0 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg"
        style={{
          backgroundColor: userColor,
        }}
      >
        {userName}
      </div>
    </div>
  );
};
