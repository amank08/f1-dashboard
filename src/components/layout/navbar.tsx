"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Trophy, Flag, Menu, X, Timer, BarChart3 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Flag },
  { href: "/live", label: "Timing", icon: Timer },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/standings", label: "Standings", icon: Trophy },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-f1-border bg-f1-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-f1-red font-bold text-white">
            F1
          </div>
          <span className="text-lg font-bold tracking-tight">Dashboard</span>
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
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-f1-red/10 text-f1-red"
                    : "text-f1-text-secondary hover:text-f1-text"
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-f1-text-secondary"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-f1-border bg-f1-surface px-4 pb-4 md:hidden">
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
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-f1-red/10 text-f1-red"
                    : "text-f1-text-secondary hover:text-f1-text"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
