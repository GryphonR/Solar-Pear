import React from 'react';

// Pear artwork in a 52 x 56 box. Shared by the full lockup (tilted) and the small mark (upright).
const PearArt = () => (
    <>
        {/* Left half (golden yellow) with dark outline for contrast */}
        <path d="M 26 12 C 19 12, 17 19, 15 25 C 13 31, 7 35, 9 42 C 11 49, 21 51, 26 51 Z" fill="#facc15" stroke="#713f12" strokeWidth="1.25" strokeLinejoin="round" paintOrder="stroke fill" />
        {/* Left highlight */}
        <path d="M 24 15 C 20 15, 19 20, 18 25 C 17 29, 11 34, 13 39 C 14 44, 21 46, 24 46 Z" fill="#fef08a" opacity="0.6" />
        {/* Right half (darker gold) with dark outline */}
        <path d="M 26 12 C 33 12, 35 19, 37 25 C 39 31, 45 35, 43 42 C 41 49, 31 51, 26 51 Z" fill="#ca8a04" stroke="#713f12" strokeWidth="1.25" strokeLinejoin="round" paintOrder="stroke fill" />
        {/* Solar grid inside right half */}
        <g clipPath="url(#rightPear)">
            <path d="M26 22 L50 22 M26 32 L50 32 M26 42 L50 42" stroke="#854d0e" strokeWidth="1.5" />
            <path d="M31 12 L31 51 M38 12 L38 51" stroke="#854d0e" strokeWidth="1.5" />
        </g>
        {/* Stem */}
        <path d="M 26 12 Q 26 2, 33 4" stroke="#713f12" strokeWidth="2.5" strokeLinecap="round" />
    </>
);

const RightPearClip = () => (
    <defs>
        <clipPath id="rightPear">
            <path d="M 26 12 C 33 12, 35 19, 37 25 C 39 31, 45 35, 43 42 C 41 49, 31 51, 26 51 Z" />
        </clipPath>
    </defs>
);

/**
 * Approved lockup (roadmap 13.1, "option 11"): pear on the left tilted 14 degrees, SOLAR over a smaller PEAR.
 * Text colour follows `currentColor`, so set it with a text-* class.
 * With `mark`, renders just the upright pear (favicon, collapsed rail, small sizes); the tilt is for the full lockup only.
 */
const SolarPearLogo = ({ className = 'w-full h-auto', mark = false }) =>
    mark ? (
        <svg viewBox="0 0 52 56" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Solar Pear">
            <RightPearClip />
            <PearArt />
        </svg>
    ) : (
        <svg viewBox="0 0 140 56" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Solar Pear">
            <RightPearClip />
            <g transform="rotate(14, 26, 31)">
                <PearArt />
            </g>
            <text x="58" y="30" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="22" fill="currentColor" letterSpacing="1.5">SOLAR</text>
            <text x="59" y="49" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="16" fill="#facc15" stroke="#713f12" strokeWidth="2" strokeLinejoin="round" paintOrder="stroke fill" letterSpacing="2.5">PEAR</text>
        </svg>
    );

export default SolarPearLogo;
