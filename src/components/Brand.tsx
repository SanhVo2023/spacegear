export default function Brand({ large = false }: { large?: boolean }) {
  return <span className={`brand ${large ? "brand-large" : ""}`}><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="1.7"/><ellipse cx="20" cy="20" rx="21" ry="7" transform="rotate(-35 20 20)" stroke="currentColor" strokeWidth="1.7"/><circle cx="32.5" cy="10.5" r="2.5" fill="currentColor"/></svg><span>spacegear<span className="brand-domain">.tech</span></span></span>;
}
