/** The space—gear wordmark, styled exactly like the original plat—form mark.
 *  ™ (not ®) until the mark is registered. */
export default function Brand() {
  return (
    <span className="text-[19px] font-medium tracking-tight text-flame">
      space<span className="text-ink">—</span>gear
      <sup className="ml-0.5 text-[9px] text-mut-3">™</sup>
    </span>
  );
}
