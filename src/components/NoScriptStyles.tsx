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
].join("");

export default function NoScriptStyles() {
  return <noscript dangerouslySetInnerHTML={{ __html: `<style>${CSS}</style>` }} />;
}
