import React from 'react';

const IntelligentInvitesIcon = ({
  className = 'w-8 h-8',
}: {
  className?: string;
}) => (
  <svg
    className={className}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="inviteGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
    </defs>

    {/* Mail envelope */}
    <path
      d="M8 20 L32 36 L56 20 L56 48 C56 50.2 54.2 52 52 52 L12 52 C9.8 52 8 50.2 8 48 Z"
      fill="url(#inviteGradient)"
      opacity="0.1"
    />
    <path
      d="M8 20 L32 36 L56 20 L56 48 C56 50.2 54.2 52 52 52 L12 52 C9.8 52 8 50.2 8 48 Z"
      stroke="url(#inviteGradient)"
      strokeWidth="2"
      fill="none"
    />

    {/* Mail flap */}
    <path
      d="M8 20 L32 36 L56 20"
      stroke="url(#inviteGradient)"
      strokeWidth="2"
      fill="none"
    />

    {/* Content lines */}
    <line
      x1="16"
      y1="28"
      x2="48"
      y2="28"
      stroke="url(#inviteGradient)"
      strokeWidth="1.5"
      opacity="0.6"
    />
    <line
      x1="16"
      y1="32"
      x2="40"
      y2="32"
      stroke="url(#inviteGradient)"
      strokeWidth="1.5"
      opacity="0.4"
    />
    <line
      x1="16"
      y1="36"
      x2="44"
      y2="36"
      stroke="url(#inviteGradient)"
      strokeWidth="1.5"
      opacity="0.6"
    />

    {/* Smart elements */}
    <circle cx="48" cy="12" r="3" fill="#10B981" opacity="0.8">
      <animate
        attributeName="r"
        values="3;4;3"
        dur="2s"
        repeatCount="indefinite"
      />
    </circle>
    <path
      d="M46 12 L48 14 L52 10"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Notification dots */}
    <circle cx="52" cy="16" r="2" fill="#EF4444" opacity="0.9">
      <animate
        attributeName="opacity"
        values="0.9;1;0.9"
        dur="1.5s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="12" cy="14" r="1.5" fill="#F59E0B" opacity="0.7">
      <animate
        attributeName="opacity"
        values="0.7;1;0.7"
        dur="2.2s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

export default IntelligentInvitesIcon;
