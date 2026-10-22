"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Grain from "./Grain";
import { useForcedColors, useFx, useMotionOK } from "./env";
import { useSmoothAnchors } from "./smooth-anchors";

// Lenis and the cursor load on demand, in their own chunks, the first time a fine-pointer desktop renders
// them: phones, tablets, touch screens and reduced motion never download them. Neither ever renders on the
// server (FxLayer renders nothing there), so the static markup is unchanged.
const SmoothScroll = dynamic(() => import("./SmoothScroll"), { ssr: false });
const Cursor = dynamic(() => import("./Cursor"), { ssr: false });

/**
 * Site-wide effects, mounted once in the root layout. It renders nothing on the server, during hydration,
 * on coarse pointers, below 1024 px, under reduced motion or without JavaScript. The flags it sets on <html>
 * scope the effect CSS (globals.css, FX block): data-fx-motion (motion allowed: reveals and scroll draws)
 * and data-fx (fine pointer at >=1024 px: heavy effects). Where motion is allowed it also sets
 * data-fx-smooth-anchors and Next's data-scroll-behavior (smooth-anchors.ts), so in-page anchors glide
 * while restorations, deep links and route changes land at once. It touches no other attribute on <html>:
 * the intro gate's data-intro and data-save-data stay the gate's own, and Lenis manages its own classes.
 * Lenis and the cursor arrive a moment after the flags, once their chunks load.
 */
export default function FxLayer() {
  const fx = useFx();
  const motionOK = useMotionOK();
  const forcedColors = useForcedColors();
  useSmoothAnchors(motionOK);

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-fx-motion", motionOK);
    return () => root.removeAttribute("data-fx-motion");
  }, [motionOK]);

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-fx", fx);
    return () => root.removeAttribute("data-fx");
  }, [fx]);

  if (!fx) return null;
  return (
    <>
      <SmoothScroll />
      <Grain />
      {/* In forced colours the system cursor stays: it follows the visitor's high-contrast settings. */}
      {!forcedColors && <Cursor />}
    </>
  );
}
