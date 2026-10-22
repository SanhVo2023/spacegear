// Without JavaScript, entrance animations never run. These rules show their
// end state so every heading, paragraph, bar and chart stays visible.
const CSS = [
  "[data-reveal],.reveal{opacity:1!important;transform:none!important;filter:none!important}",
  "[data-scroll-word]{opacity:1!important;color:#e3dbd8!important}",
  "[data-fill]{width:var(--fill)!important}",
  "[data-fill-h]{height:var(--fill)!important}",
  "[data-fill-svg]{width:100%!important}",
  "[data-line]{width:100%!important}",
  "[data-dot]{transform:none!important}",
  // The hero only reserves the cinematic's height for a hydration that never comes.
  ".hero-reserve{min-height:0!important}",
  // The desktop poster stays static, so it fades into the page above the statement (globals.css).
  "@media (min-width:1024px){.hero-static-backdrop{-webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent);mask-image:linear-gradient(to bottom,#000 72%,transparent)}}",
].join("");

export default function NoScriptStyles() {
  return <noscript dangerouslySetInnerHTML={{ __html: `<style>${CSS}</style>` }} />;
}
