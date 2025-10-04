import React from 'react';

const LightningFastIcon = ({
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
      <linearGradient
        id="lightningGradient"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>

    {/* Lightning bolt */}
    <path
      d="M32 8 L20 28 L28 28 L16 48 L36 28 L28 28 Z"
      fill="url(#lightningGradient)"
      opacity="0.9"
    />

    {/* Lightning outline */}
    <path
      d="M32 8 L20 28 L28 28 L16 48 L36 28 L28 28 Z"
      stroke="url(#lightningGradient)"
      strokeWidth="1"
      fill="none"
    />

    {/* Speed lines */}
    <line
      x1="8"
      y1="16"
      x2="16"
      y2="16"
      stroke="url(#lightningGradient)"
      strokeWidth="2"
      opacity="0.6"
    >
      <animate
        attributeName="x2"
        values="16;24;16"
        dur="1s"
        repeatCount="indefinite"
      />
    </line>
    <line
      x1="8"
      y1="24"
      x2="14"
      y2="24"
      stroke="url(#lightningGradient)"
      strokeWidth="2"
      opacity="0.4"
    >
      <animate
        attributeName="x2"
        values="14;20;14"
        dur="1.2s"
        repeatCount="indefinite"
      />
    </line>
    <line
      x1="8"
      y1="32"
      x2="12"
      y2="32"
      stroke="url(#lightningGradient)"
      strokeWidth="2"
      opacity="0.5"
    >
      <animate
        attributeName="x2"
        values="12;18;12"
        dur="0.8s"
        repeatCount="indefinite"
      />
    </line>

    {/* Speed indicators */}
    <circle cx="48" cy="16" r="3" fill="#F59E0B" opacity="0.8">
      <animate
        attributeName="r"
        values="3;4;3"
        dur="1.5s"
        repeatCount="indefinite"
      />
    </circle>
    <text
      x="48"
      y="20"
      textAnchor="middle"
      fontSize="8"
      fill="white"
      fontWeight="bold"
    >
      2s
    </text>

    {/* Energy particles */}
    <circle cx="44" cy="8" r="1" fill="#F59E0B" opacity="0.7">
      <animate
        attributeName="opacity"
        values="0.7;1;0.7"
        dur="1s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="52" cy="12" r="1.5" fill="#F59E0B" opacity="0.6">
      <animate
        attributeName="opacity"
        values="0.6;1;0.6"
        dur="1.3s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="46" cy="6" r="0.8" fill="#F59E0B" opacity="0.8">
      <animate
        attributeName="opacity"
        values="0.8;1;0.8"
        dur="0.9s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

export default LightningFastIcon;
