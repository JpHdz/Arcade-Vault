"use client";

import { useEffect } from "react";

/**
 * Renders nothing. Watches every `.reveal` element on the page and adds `in`
 * the first time it crosses into the viewport, which is what the stylesheet
 * animates. Each element is unobserved once it fires, so the effect only ever
 * plays forwards.
 */
export function RevealObserver() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
