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
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050506]/72 shadow-[0_1px_0_rgba(255,255,255,0.04),0_10px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="premium-focus group flex items-center rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/u-logo.svg"
            alt="Undercut"
            width={155}
            height={32}
            className="h-6 w-auto drop-shadow-[0_0_18px_rgba(110,162,244,0.24)] transition duration-300 ease-premium group-hover:scale-[1.015]"
          />
        </Link>

        <div className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl md:flex">
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
                  "premium-focus flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-premium",
                  isActive
                    ? "bg-f1-text text-f1-bg shadow-[0_0_0_1px_rgba(255,255,255,0.24),0_8px_24px_rgba(255,255,255,0.08)]"
                    : "text-f1-text-secondary hover:bg-white/[0.07] hover:text-f1-text"
                )}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <button
          className="premium-focus rounded-lg border border-white/[0.08] bg-white/[0.05] p-2 text-f1-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-300 ease-premium hover:bg-white/[0.08] hover:text-f1-text md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.06] bg-[#050506]/95 px-5 pb-5 pt-3 shadow-[0_18px_50px_rgba(0,0,0,0.4)] backdrop-blur-2xl md:hidden">
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
                  "premium-focus flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-300 ease-premium",
                  isActive
                    ? "bg-f1-text text-f1-bg shadow-[0_8px_24px_rgba(255,255,255,0.08)]"
                    : "text-f1-text-secondary hover:bg-white/[0.07] hover:text-f1-text"
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
