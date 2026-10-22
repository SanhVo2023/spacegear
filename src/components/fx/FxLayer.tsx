"use client";

import { useEffect } from "react";
import Grain from "./Grain";
import { useFx, useMotionOK } from "./env";

/**
 * Site-wide effects, mounted once in the root layout. It renders nothing on the server, during hydration,
 * on coarse pointers, below 1024 px, under reduced motion or without JavaScript. The flags it sets on <html>
 * scope the effect CSS (globals.css, FX block): data-fx-motion (motion allowed: reveals and scroll draws)
 * and data-fx (fine pointer at >=1024 px: heavy effects). It touches no other attribute on <html>: the
 * intro gate's data-intro and data-save-data stay the gate's own.
 */
export default function FxLayer() {
  const fx = useFx();
  const motionOK = useMotionOK();

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
  return <Grain />;
}
