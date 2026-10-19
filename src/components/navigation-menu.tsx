"use client";
import type { ReactNode } from "react";
export function NavigationMenu({ children, className }: { children: ReactNode; className?: string }) {
  return <details className={className} onClick={event => { if (event.target instanceof Element && event.target.closest("a")) event.currentTarget.open = false; }}>{children}</details>;
}
