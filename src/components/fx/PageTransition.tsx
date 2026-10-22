"use client";

import { usePathname } from "next/navigation";
import { Fragment, ViewTransition, type ReactNode } from "react";

/**
 * Orange curtain between routes (React <ViewTransition> + Next's experimental.viewTransition). Keying by
 * pathname makes every route change exit the old page and enter the new one together with a full-viewport
 * curtain element, also between two pages under one first segment (/services/a/ → /services/b/), which
 * template.tsx alone would not remount; globals.css (FX block) turns those snapshots into the wipe and lifts
 * the nav and the cursor above it. Same-page hash links and search-param changes keep the key, so they never
 * animate, and neither does the first load (hydration is not a transition). Where the View Transitions API
 * is missing, React commits at once; under reduced motion the animations last 0 s.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Fragment key={pathname}>
      <ViewTransition enter="fx-curtain" exit="none" update="none" default="none">
        <div aria-hidden className="fx-vt-curtain" />
      </ViewTransition>
      <ViewTransition enter="fx-page-in" exit="fx-page-out" update="none" default="none">
        {children}
      </ViewTransition>
    </Fragment>
  );
}
