import { introGateScript } from "@/components/globe/intro-gate";

/**
 * Runs inline before first paint and marks html[data-intro="play"] on a first desktop visit to
 * the home page (rules in intro-gate.ts). Without JavaScript nothing is marked, so the intro
 * overlay never shows. CSP: script-src already allows inline scripts ('unsafe-inline', which Next's
 * own inline scripts need too), so no hash is added: a hash would make browsers ignore 'unsafe-inline'.
 */
export default function IntroGate() {
  return <script dangerouslySetInnerHTML={{ __html: introGateScript() }} />;
}
