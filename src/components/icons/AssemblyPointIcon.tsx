const AssemblyPointIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Four inward-pointing arrows in corners */}
    {/* Top-left */}
    <path d="M4 4 L20 4 L14.5 9.5 L22 17 L17 22 L9.5 14.5 L4 20 Z" />
    {/* Top-right */}
    <path d="M60 4 L60 20 L54.5 14.5 L47 22 L42 17 L49.5 9.5 L44 4 Z" />
    {/* Bottom-left */}
    <path d="M4 60 L4 44 L9.5 49.5 L17 42 L22 47 L14.5 54.5 L20 60 Z" />
    {/* Bottom-right */}
    <path d="M60 60 L44 60 L49.5 54.5 L42 47 L47 42 L54.5 49.5 L60 44 Z" />

    {/* People group in center */}
    {/* Back-left head */}
    <circle cx="26" cy="22" r="3" />
    {/* Back-center head */}
    <circle cx="32" cy="20.5" r="3.2" />
    {/* Back-right head */}
    <circle cx="38.5" cy="23" r="2.8" />
    {/* Back bodies (parents) */}
    <path d="M22 36 C22 30 24 27 28 27 L34 27 C38 27 40 30 40 36 L40 42 L36 42 L36 36 L26 36 L26 42 L22 42 Z" />
    {/* Right adult (woman silhouette with skirt) */}
    <path d="M38 27 C42 27 44 30 44 36 L44 44 L41 44 L40 39 L38 44 L35 44 L35 36 C35 30 36 27 38 27 Z" />

    {/* Front-left small head (child) */}
    <circle cx="25" cy="32" r="2.4" />
    {/* Front-left small body */}
    <path d="M22 42 C22 38 23 36 25 36 C27 36 28 38 28 42 L28 48 L25.5 48 L25.5 44 L24.5 44 L24.5 48 L22 48 Z" />

    {/* Front-center child */}
    <circle cx="31.5" cy="34" r="2.2" />
    <path d="M29 43 C29 40 30 38 31.5 38 C33 38 34 40 34 43 L34 49 L32.5 49 L32 45.5 L31 45.5 L30.5 49 L29 49 Z" />
  </svg>
);

export default AssemblyPointIcon;
