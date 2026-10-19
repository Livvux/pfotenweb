"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Progressive enhancement: server HTML is always visible, even without JS.
 * Uses the native Web Animations API (`element.animate`) instead of
 * framer-motion. `element.animate` never touches the element's inline
 * `style` attribute, so `animation.cancel()` alone reverts an element to its
 * pre-animation appearance (fully visible, no offset) — no manual style
 * bookkeeping needed to support the reduced-motion/cleanup path below.
 */
export function PublicMotion({ enabled = true, duration }: { enabled?: boolean; duration?: number }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!enabled) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !("IntersectionObserver" in window)) return;
    const animations: Animation[] = [];
    // Preview strips (duration set) stagger far tighter than full-page reveals.
    const delayStep = duration ? 0.02 : 0.08;
    const delayCap = duration ? 0.04 : 0.24;
    const observer = new IntersectionObserver((entries) => {
      let index = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
        const element = entry.target;
        observer.unobserve(element);
        animations.push(element.animate(
          [
            { opacity: 0.65, transform: "translateY(12px)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: (duration ?? (element.hasAttribute("data-motion-preview") ? 0.8 : 0.7)) * 1000,
            delay: Math.min(index++ * delayStep, delayCap) * 1000,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            // Only the delay needs the start frame; afterwards natural styles (hover transforms) apply again.
            fill: "backwards",
          },
        ));
      }
    }, { threshold: 0.08 });
    // Leaf sections avoid animating both an ancestor and its children (24px travel).
    const surfaces = document.querySelectorAll<HTMLElement>("[data-motion-surface] main section, [data-motion-surface] main article, [data-motion-surface] main [data-motion-preview]");
    surfaces.forEach(element => {
      if (!element.querySelector("section, article, [data-motion-preview]")) observer.observe(element);
    });
    function stop() {
      observer.disconnect();
      animations.forEach(animation => animation.cancel());
    }
    preference.addEventListener("change", stop);
    return () => { stop(); preference.removeEventListener("change", stop); };
  }, [pathname, enabled, duration]);
  return null;
}
