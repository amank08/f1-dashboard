"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

export function MagneticLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    const xTo = gsap.quickTo(element, "x", { duration: 0.35, ease: "power3.out" });
    const yTo = gsap.quickTo(element, "y", { duration: 0.35, ease: "power3.out" });
    const scaleXTo = gsap.quickTo(element, "scaleX", { duration: 0.25, ease: "power2.out" });
    const scaleYTo = gsap.quickTo(element, "scaleY", { duration: 0.25, ease: "power2.out" });

    const onPointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const relX = event.clientX - (rect.left + rect.width / 2);
      const relY = event.clientY - (rect.top + rect.height / 2);
      xTo(relX * 0.14);
      yTo(relY * 0.22);
      scaleXTo(1.025);
      scaleYTo(1.025);
    };

    const reset = () => {
      xTo(0);
      yTo(0);
      scaleXTo(1);
      scaleYTo(1);
    };

    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerleave", reset);
    element.addEventListener("blur", reset);

    return () => {
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerleave", reset);
      element.removeEventListener("blur", reset);
      gsap.killTweensOf(element);
    };
  }, []);

  return (
    <Link ref={ref} href={href} className={className}>
      {children}
    </Link>
  );
}
