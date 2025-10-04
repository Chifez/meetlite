import React from 'react';

const GlobalCDNIcon = ({ className = 'w-8 h-8' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="cdnGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
    </defs>

    {/* Globe */}
    <circle cx="32" cy="32" r="20" fill="url(#cdnGradient)" opacity="0.1" />
    <circle
      cx="32"
      cy="32"
      r="20"
      stroke="url(#cdnGradient)"
      strokeWidth="2"
      fill="none"
    />

    {/* Globe grid lines */}
    <ellipse
      cx="32"
      cy="32"
      rx="20"
      ry="8"
      fill="none"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.3"
    />
    <ellipse
      cx="32"
      cy="32"
      rx="20"
      ry="12"
      fill="none"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.2"
    />
    <ellipse
      cx="32"
      cy="32"
      rx="20"
      ry="16"
      fill="none"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.3"
    />

    {/* Vertical lines */}
    <line
      x1="12"
      y1="32"
      x2="52"
      y2="32"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.2"
    />
    <line
      x1="22"
      y1="12"
      x2="22"
      y2="52"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.2"
    />
    <line
      x1="42"
      y1="12"
      x2="42"
      y2="52"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.2"
    />

    {/* Server nodes */}
    <circle cx="20" cy="20" r="3" fill="url(#cdnGradient)" opacity="0.8">
      <animate
        attributeName="opacity"
        values="0.8;1;0.8"
        dur="2s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="44" cy="20" r="3" fill="url(#cdnGradient)" opacity="0.8">
      <animate
        attributeName="opacity"
        values="0.8;1;0.8"
        dur="2.2s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="20" cy="44" r="3" fill="url(#cdnGradient)" opacity="0.8">
      <animate
        attributeName="opacity"
        values="0.8;1;0.8"
        dur="1.8s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="44" cy="44" r="3" fill="url(#cdnGradient)" opacity="0.8">
      <animate
        attributeName="opacity"
        values="0.8;1;0.8"
        dur="2.5s"
        repeatCount="indefinite"
      />
    </circle>

    {/* Connection lines */}
    <line
      x1="20"
      y1="20"
      x2="32"
      y2="32"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.4"
    >
      <animate
        attributeName="opacity"
        values="0.4;0.8;0.4"
        dur="3s"
        repeatCount="indefinite"
      />
    </line>
    <line
      x1="44"
      y1="20"
      x2="32"
      y2="32"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.4"
    >
      <animate
        attributeName="opacity"
        values="0.4;0.8;0.4"
        dur="3.2s"
        repeatCount="indefinite"
      />
    </line>
    <line
      x1="20"
      y1="44"
      x2="32"
      y2="32"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.4"
    >
      <animate
        attributeName="opacity"
        values="0.4;0.8;0.4"
        dur="2.8s"
        repeatCount="indefinite"
      />
    </line>
    <line
      x1="44"
      y1="44"
      x2="32"
      y2="32"
      stroke="url(#cdnGradient)"
      strokeWidth="1"
      opacity="0.4"
    >
      <animate
        attributeName="opacity"
        values="0.4;0.8;0.4"
        dur="3.5s"
        repeatCount="indefinite"
      />
    </line>

    {/* Central hub */}
    <circle cx="32" cy="32" r="4" fill="url(#cdnGradient)" opacity="0.9" />
  </svg>
);

export default GlobalCDNIcon;
