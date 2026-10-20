export default function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro site-container"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-description">{description}</p></div>;
}
