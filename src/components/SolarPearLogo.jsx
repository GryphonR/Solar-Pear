import React from 'react';

const SolarPearLogo = ({ className = "w-full h-auto" }) => (
    <svg viewBox="0 0 160 56" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <clipPath id="rightPear">
                <path d="M 26 12 C 33 12, 35 19, 37 25 C 39 31, 45 35, 43 42 C 41 49, 31 51, 26 51 Z" />
            </clipPath>
        </defs>

        {/* Stacked Text */}
        <text x="30" y="26" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="16" fill="currentColor" letterSpacing="1.5">SOLAR</text>
        <text x="22" y="46" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="22" fill="#4ade80" letterSpacing="0.5">PEAR</text>

        {/* Pear Graphic */}
        <g transform="translate(88, 2) rotate(14, 26, 31)">
            {/* Left Half (Light Green) */}
            <path d="M 26 12 C 19 12, 17 19, 15 25 C 13 31, 7 35, 9 42 C 11 49, 21 51, 26 51 Z" fill="#4ade80" />

            {/* Left Highlight */}
            <path d="M 24 15 C 20 15, 19 20, 18 25 C 17 29, 11 34, 13 39 C 14 44, 21 46, 24 46 Z" fill="#86efac" opacity="0.6" />

            {/* Right Half (Darker Green) */}
            <path d="M 26 12 C 33 12, 35 19, 37 25 C 39 31, 45 35, 43 42 C 41 49, 31 51, 26 51 Z" fill="#16a34a" />

            {/* Solar Grid inside Right Half */}
            <g clipPath="url(#rightPear)">
                <path d="M26 22 L50 22 M26 32 L50 32 M26 42 L50 42" stroke="#14532d" strokeWidth="1.5" />
                <path d="M31 12 L31 51 M38 12 L38 51" stroke="#14532d" strokeWidth="1.5" />
            </g>

            {/* Stem */}
            <path d="M 26 12 Q 26 2, 33 4" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
        </g>
    </svg>
);

export default SolarPearLogo;
