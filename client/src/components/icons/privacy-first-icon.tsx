import React from 'react';

const PrivacyFirstIcon = ({
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
      <linearGradient id="privacyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>

    {/* Shield base */}
    <path
      d="M32 8 L48 16 L48 32 C48 44 32 56 32 56 C32 56 16 44 16 32 L16 16 Z"
      fill="url(#privacyGradient)"
      opacity="0.1"
    />
    <path
      d="M32 8 L48 16 L48 32 C48 44 32 56 32 56 C32 56 16 44 16 32 L16 16 Z"
      stroke="url(#privacyGradient)"
      strokeWidth="2"
      fill="none"
    />

    {/* Shield inner pattern */}
    <path
      d="M32 12 L44 18 L44 30 C44 38 32 48 32 48 C32 48 20 38 20 30 L20 18 Z"
      fill="url(#privacyGradient)"
      opacity="0.2"
    />

    {/* Lock icon */}
    <rect
      x="28"
      y="24"
      width="8"
      height="10"
      rx="2"
      fill="url(#privacyGradient)"
      opacity="0.8"
    />
    <path
      d="M30 24 L30 20 C30 18 31 16 32 16 C33 16 34 18 34 20 L34 24"
      stroke="url(#privacyGradient)"
      strokeWidth="2"
      fill="none"
    />

    {/* Encryption symbols */}
    <circle cx="24" cy="20" r="2" fill="#10B981" opacity="0.6">
      <animate
        attributeName="opacity"
        values="0.6;1;0.6"
        dur="2s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="40" cy="22" r="1.5" fill="#10B981" opacity="0.7">
      <animate
        attributeName="opacity"
        values="0.7;1;0.7"
        dur="2.5s"
        repeatCount="indefinite"
      />
    </circle>

    {/* Security checkmark */}
    <circle cx="32" cy="32" r="4" fill="url(#privacyGradient)" opacity="0.9" />
    <path
      d="M30 32 L31.5 33.5 L34 31"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default PrivacyFirstIcon;
