"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Menu, X, Timer, Trophy, CalendarDays } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Flag },
  { href: "/live", label: "Timing", icon: Timer },
  { href: "/standings", label: "Standings", icon: Trophy },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-f1-border/50 bg-f1-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-f1-accent font-bold text-white text-xs">
            UC
          </div>
          <span className="text-base font-semibold tracking-tight">Undercut</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-f1-accent-light text-f1-accent"
                    : "text-f1-text-secondary hover:bg-f1-surface hover:text-f1-text"
                )}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-f1-text-secondary hover:text-f1-text transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-f1-border/50 bg-f1-bg/95 backdrop-blur-xl px-6 pb-4 md:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-f1-accent-light text-f1-accent"
                    : "text-f1-text-secondary hover:bg-f1-surface hover:text-f1-text"
                )}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
