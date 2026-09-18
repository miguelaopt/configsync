/** Abstract ribbon for the auth panel — SVG + blur, no images. Purely decorative. */
export function Ribbon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 900 1000"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        {/* Deep purple at the bottom-left, bright lavender where the band catches the light. */}
        <linearGradient id="rb-main" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#3b2f86" />
          <stop offset="0.35" stopColor="#6f61ba" />
          <stop offset="0.7" stopColor="#a598ec" />
          <stop offset="1" stopColor="#e9e4ff" />
        </linearGradient>
        <linearGradient id="rb-fold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#5a4ea8" />
          <stop offset="0.6" stopColor="#8f80e0" />
          <stop offset="1" stopColor="#d3ccff" />
        </linearGradient>
        <linearGradient id="rb-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="rb-glow" cx="0.4" cy="0.4" r="0.75">
          <stop offset="0" stopColor="#6f61ba" stopOpacity="0.5" />
          <stop offset="1" stopColor="#6f61ba" stopOpacity="0" />
        </radialGradient>
        <filter
          id="rb-blur-xl"
          filterUnits="userSpaceOnUse"
          x="-600"
          y="-600"
          width="2200"
          height="2200"
        >
          <feGaussianBlur stdDeviation="60" />
        </filter>
        <filter
          id="rb-blur-md"
          filterUnits="userSpaceOnUse"
          x="-600"
          y="-600"
          width="2200"
          height="2200"
        >
          <feGaussianBlur stdDeviation="26" />
        </filter>
        <filter
          id="rb-blur-xs"
          filterUnits="userSpaceOnUse"
          x="-600"
          y="-600"
          width="2200"
          height="2200"
        >
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      <rect width="900" height="1000" fill="url(#rb-glow)" />

      {/* Ambient band, very soft */}
      <path
        d="M -260 760 C 80 240, 440 20, 1160 300"
        fill="none"
        stroke="#7a6cc4"
        strokeWidth="340"
        strokeLinecap="round"
        opacity="0.35"
        filter="url(#rb-blur-xl)"
      />

      {/* Shadow under the ribbon gives it thickness */}
      <path
        d="M -200 880 C 120 380, 440 180, 1120 400"
        fill="none"
        stroke="#05060c"
        strokeWidth="230"
        strokeLinecap="round"
        opacity="0.75"
        filter="url(#rb-blur-md)"
      />

      {/* The ribbon: crisp edges, gradient across its length */}
      <path
        d="M -200 840 C 120 340, 440 140, 1120 360"
        fill="none"
        stroke="url(#rb-main)"
        strokeWidth="200"
        strokeLinecap="round"
        filter="url(#rb-blur-xs)"
      />

      {/* Inner fold: a narrower band riding the lower edge, slightly darker */}
      <path
        d="M -160 905 C 180 470, 500 270, 1120 450"
        fill="none"
        stroke="url(#rb-fold)"
        strokeWidth="110"
        strokeLinecap="round"
        opacity="0.9"
        filter="url(#rb-blur-xs)"
      />

      {/* Sheen along the top edge */}
      <path
        d="M -200 760 C 120 260, 440 60, 1120 280"
        fill="none"
        stroke="url(#rb-sheen)"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#rb-blur-xs)"
      />

      {/* Vignette so the panel edges stay dark */}
      <rect width="900" height="1000" fill="url(#rb-vignette)" />
      <defs>
        <radialGradient id="rb-vignette" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#0c0d14" stopOpacity="0" />
          <stop offset="1" stopColor="#0c0d14" stopOpacity="0.85" />
        </radialGradient>
      </defs>
    </svg>
  );
}
