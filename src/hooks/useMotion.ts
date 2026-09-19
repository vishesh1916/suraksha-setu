'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * useIntersectionObserver: Triggers when an element enters the viewport.
 * Uses a single trigger (once: true by default) for dignified, permanent scroll discovery.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback if IntersectionObserver is unsupported
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.unobserve(el);
      }
    }, options);

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [options.threshold, options.rootMargin]);

  return { ref, isInView };
}

/**
 * useSmoothCounter: Apple / Bloomberg Terminal style ease-out count-up animation.
 * Smoothly interpolates from 0 to target over duration using cubic ease-out.
 */
export function useSmoothCounter(
  target: number,
  duration = 1600,
  shouldStart = true
) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!shouldStart) return;

    let startTimestamp: number | null = null;
    let animId: number;

    const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = easeOutCubic(progress);
      setCount(Math.round(easedProgress * target));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, duration, shouldStart]);

  return count;
}

/**
 * useSubtleParallax: Clamped 20-30px physical depth parallax for imagery and telemetry cards.
 */
export function useSubtleParallax(speed = 0.04, maxOffset = 24) {
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const calculated = Math.min(Math.max(-maxOffset, scrollY * speed), maxOffset);
          setOffsetY(calculated);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed, maxOffset]);

  return offsetY;
}
