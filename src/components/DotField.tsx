/**
 * Grid of dots with a diagonal wave that sweeps a bright pulse through the
 * formation — they appear to constantly shift and move. Driven by the
 * `.dot-pulse` keyframes in globals.css, so it costs no JavaScript frames
 * and stops under prefers-reduced-motion.
 */
export default function DotField({
  cols = 5,
  rows = 5,
  color = "#fa6e43",
  className = "",
  dotClassName = "h-1.5 w-1.5",
}: {
  cols?: number;
  rows?: number;
  color?: string;
  className?: string;
  dotClassName?: string;
}) {
  const cells = Array.from({ length: rows * cols }, (_, i) => ({
    r: Math.floor(i / cols),
    c: i % cols,
  }));
  return (
    <div
      aria-hidden
      className={`grid place-items-center gap-y-3 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {cells.map(({ r, c }, i) => (
        <span
          key={i}
          className={`dot-pulse rounded-full ${dotClassName}`}
          style={{
            backgroundColor: color,
            animationDelay: `${((r + c) % (cols + 1)) * 0.22}s`,
          }}
        />
      ))}
    </div>
  );
}
