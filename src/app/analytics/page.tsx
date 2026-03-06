"use client";

import Link from "next/link";
import { Users, MapPin, TrendingUp, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

const ANALYTICS_CARDS = [
  {
    href: "/analytics/head-to-head",
    title: "Head-to-Head",
    description:
      "Compare two drivers side-by-side across qualifying and race results, points, and key statistics.",
    icon: Users,
    color: "text-blue-400",
  },
  {
    href: "/analytics/circuits",
    title: "Circuit Stats",
    description:
      "Explore historical data for each circuit — track records, most wins, average positions, and weather patterns.",
    icon: MapPin,
    color: "text-green-400",
  },
  {
    href: "/analytics/season",
    title: "Season Overview",
    description:
      "Season-wide statistics including pole-to-win rates, penalty counts, safety car frequency, and driver consistency.",
    icon: TrendingUp,
    color: "text-amber-400",
  },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Deep dive into F1 data across drivers, circuits, and seasons"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ANALYTICS_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <div className="group rounded-lg border border-f1-border bg-f1-surface p-6 transition-all hover:border-f1-red/50 hover:bg-f1-card">
                <div className={`flex items-center gap-2 text-sm font-semibold uppercase ${card.color}`}>
                  <Icon size={16} />
                  {card.title}
                </div>
                <p className="mt-3 text-sm text-f1-text-secondary">
                  {card.description}
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-f1-red opacity-0 transition-opacity group-hover:opacity-100">
                  Explore <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
