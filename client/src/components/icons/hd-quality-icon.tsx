import React from 'react';

const HDQualityIcon = ({ className = 'w-8 h-8' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="hdGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#DC2626" />
      </linearGradient>
    </defs>

    {/* Monitor frame */}
    <rect
      x="8"
      y="12"
      width="48"
      height="32"
      rx="4"
      fill="url(#hdGradient)"
      opacity="0.1"
    />
    <rect
      x="8"
      y="12"
      width="48"
      height="32"
      rx="4"
      stroke="url(#hdGradient)"
      strokeWidth="2"
      fill="none"
    />

    {/* Screen */}
    <rect
      x="12"
      y="16"
      width="40"
      height="24"
      rx="2"
      fill="url(#hdGradient)"
      opacity="0.2"
    />

    {/* Monitor stand */}
    <rect
      x="28"
      y="44"
      width="8"
      height="4"
      fill="url(#hdGradient)"
      opacity="0.6"
    />
    <rect
      x="24"
      y="48"
      width="16"
      height="2"
      fill="url(#hdGradient)"
      opacity="0.4"
    />

    {/* HD indicator */}
    <rect
      x="16"
      y="20"
      width="8"
      height="4"
      rx="1"
      fill="url(#hdGradient)"
      opacity="0.8"
    />
    <text
      x="20"
      y="23"
      textAnchor="middle"
      fontSize="6"
      fill="white"
      fontWeight="bold"
    >
      4K
    </text>

    {/* Quality bars */}
    <rect
      x="16"
      y="28"
      width="2"
      height="8"
      fill="url(#hdGradient)"
      opacity="0.7"
    />
    <rect
      x="20"
      y="26"
      width="2"
      height="10"
      fill="url(#hdGradient)"
      opacity="0.8"
    />
    <rect
      x="24"
      y="24"
      width="2"
      height="12"
      fill="url(#hdGradient)"
      opacity="0.9"
    />
    <rect
      x="28"
      y="22"
      width="2"
      height="14"
      fill="url(#hdGradient)"
      opacity="1"
    />
    <rect
      x="32"
      y="20"
      width="2"
      height="16"
      fill="url(#hdGradient)"
      opacity="1"
    />

    {/* Audio waves */}
    <path
      d="M40 24 Q42 22 44 24 Q46 26 48 24"
      stroke="url(#hdGradient)"
      strokeWidth="1.5"
      fill="none"
      opacity="0.6"
    >
      <animate
        attributeName="d"
        values="M40 24 Q42 22 44 24 Q46 26 48 24;M40 24 Q42 20 44 24 Q46 28 48 24;M40 24 Q42 22 44 24 Q46 26 48 24"
        dur="1.5s"
        repeatCount="indefinite"
      />
    </path>
    <path
      d="M40 28 Q42 26 44 28 Q46 30 48 28"
      stroke="url(#hdGradient)"
      strokeWidth="1.5"
      fill="none"
      opacity="0.4"
    >
      <animate
        attributeName="d"
        values="M40 28 Q42 26 44 28 Q46 30 48 28;M40 28 Q42 24 44 28 Q46 32 48 28;M40 28 Q42 26 44 28 Q46 30 48 28"
        dur="1.8s"
        repeatCount="indefinite"
      />
    </path>

    {/* Crystal clear indicator */}
    <circle cx="48" cy="8" r="3" fill="#10B981" opacity="0.8">
      <animate
        attributeName="r"
        values="3;4;3"
        dur="2s"
        repeatCount="indefinite"
      />
    </circle>
    <path
      d="M46 8 L48 10 L52 6"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default HDQualityIcon;
