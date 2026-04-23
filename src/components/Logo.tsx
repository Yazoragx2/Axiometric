import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  color?: string;
}

export function Logo({ size = 32, className = '', color = 'var(--accent)' }: LogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Hexagon Frame */}
      <path 
        d="M50 5L89.5 27.5V72.5L50 95L10.5 72.5V27.5L50 5Z" 
        stroke={color} 
        strokeWidth="1" 
        strokeOpacity="0.3"
        strokeDasharray="4 2"
      />
      
      {/* Inner Hexagon */}
      <path 
        d="M50 15L80.5 32.5V67.5L50 85L19.5 67.5V32.5L50 15Z" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeOpacity="0.6"
      />

      {/* The 'A' Core */}
      <path 
        d="M50 25L72 75H60L50 52L40 75H28L50 25Z" 
        fill={color} 
        fillOpacity="0.1"
      />
      <path 
        d="M50 25L72 75M50 25L28 75M38 65H62" 
        stroke={color} 
        strokeWidth="3.5" 
        strokeLinecap="square" 
        strokeLinejoin="miter"
      />
      
      {/* Precision Crosshair / Metric Lines */}
      <path d="M50 0V10M50 90V100M0 50H10M90 50H100" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      
      {/* Corner Accents */}
      <path d="M15 30L20 27M85 30L80 27M15 70L20 73M85 70L80 73" stroke={color} strokeWidth="1.5" strokeOpacity="0.8" />
      
      {/* Focal Point */}
      <circle cx="50" cy="52" r="2.5" fill={color} />
      <circle cx="50" cy="52" r="6" stroke={color} strokeWidth="0.5" strokeOpacity="0.5" />
    </svg>
  );
}
