import React from 'react';

const SmartSchedulingIcon = ({
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
      <linearGradient id="scheduleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#1E40AF" />
      </linearGradient>
    </defs>

    {/* Calendar base */}
    <rect
      x="8"
      y="12"
      width="48"
      height="40"
      rx="4"
      fill="url(#scheduleGradient)"
      opacity="0.1"
    />
    <rect
      x="8"
      y="12"
      width="48"
      height="40"
      rx="4"
      stroke="url(#scheduleGradient)"
      strokeWidth="2"
      fill="none"
    />

    {/* Calendar header */}
    <rect
      x="8"
      y="12"
      width="48"
      height="12"
      rx="4"
      fill="url(#scheduleGradient)"
    />
    <rect
      x="8"
      y="12"
      width="48"
      height="12"
      rx="4"
      fill="url(#scheduleGradient)"
      opacity="0.8"
    />

    {/* Calendar rings */}
    <circle cx="20" cy="18" r="1.5" fill="white" />
    <circle cx="44" cy="18" r="1.5" fill="white" />

    {/* Calendar grid */}
    <rect
      x="12"
      y="28"
      width="8"
      height="6"
      rx="1"
      fill="url(#scheduleGradient)"
      opacity="0.3"
    />
    <rect
      x="22"
      y="28"
      width="8"
      height="6"
      rx="1"
      fill="url(#scheduleGradient)"
      opacity="0.2"
    />
    <rect
      x="32"
      y="28"
      width="8"
      height="6"
      rx="1"
      fill="url(#scheduleGradient)"
      opacity="0.3"
    />
    <rect
      x="42"
      y="28"
      width="8"
      height="6"
      rx="1"
      fill="url(#scheduleGradient)"
      opacity="0.2"
    />

    <rect
      x="12"
      y="36"
      width="8"
      height="6"
      rx="1"
      fill="url(#scheduleGradient)"
      opacity="0.2"
    />
    <rect
      x="22"
      y="36"
      width="8"
      height="6"
      rx="1"
      fill="url(#scheduleGradient)"
      opacity="0.3"
    />
    <rect
      x="32"
      y="36"
      width="8"
      height="6"
      rx="1"
      fill="url(#scheduleGradient)"
      opacity="0.2"
    />
    <rect
      x="42"
      y="36"
      width="8"
      height="6"
      rx="1"
      fill="url(#scheduleGradient)"
      opacity="0.3"
    />

    {/* AI sparkles */}
    <circle cx="50" cy="8" r="2" fill="#F59E0B" opacity="0.8">
      <animate
        attributeName="opacity"
        values="0.8;1;0.8"
        dur="2s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="14" cy="6" r="1.5" fill="#10B981" opacity="0.6">
      <animate
        attributeName="opacity"
        values="0.6;1;0.6"
        dur="2.5s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="48" cy="4" r="1" fill="#EF4444" opacity="0.7">
      <animate
        attributeName="opacity"
        values="0.7;1;0.7"
        dur="1.8s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

export default SmartSchedulingIcon;
