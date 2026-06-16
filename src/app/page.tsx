"use client";

import Image from "next/image";
import Link from "next/link";
import type { PointerEvent } from "react";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Activity, ArrowRight, CalendarDays, Flag, Gauge, Radio, Timer, Trophy } from "lucide-react";
import { useMeetings } from "@/lib/hooks/use-meetings";
import { Skeleton } from "@/components/ui/skeleton";
import { MagneticLink } from "@/components/experience/magnetic-link";

const capabilities = [
  { icon: Timer, label: "Live timing", value: "Sector-aware session boards" },
  { icon: Gauge, label: "Replay", value: "Scrub laps, gaps, and race state" },
  { icon: Radio, label: "Race control", value: "Flags, incidents, and team radio" },
  { icon: Trophy, label: "Standings", value: "Driver and constructor context" },
];

function updateSpotlight(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
}

export default function Home() {
  const { data: meetings, isLoading } = useMeetings(new Date().getFullYear());

  const completedRaces = meetings?.filter((meeting) => isPast(parseISO(meeting.date_end))) ?? [];
  const upcomingRaces = meetings?.filter((meeting) => !isPast(parseISO(meeting.date_end))) ?? [];
  const latestRace = completedRaces.at(-1);
  const nextRace = upcomingRaces[0];
  const completion = meetings?.length ? Math.round((completedRaces.length / meetings.length) * 100) : 0;

  return (
    <div className="relative left-1/2 -mt-8 w-screen -translate-x-1/2 overflow-hidden">
        <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden border-b border-white/[0.06]">
          <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_74%_24%,rgba(110,162,244,0.10),transparent_36%),radial-gradient(circle_at_14%_78%,rgba(0,210,190,0.07),transparent_32%),linear-gradient(180deg,rgba(5,5,6,0.02),rgba(5,5,6,0.72)_94%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-32 bg-gradient-to-t from-f1-bg/95 to-transparent" />

          <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_420px]">
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="max-w-3xl"
            >
              <p className="mb-5 text-xs font-medium uppercase tracking-[0.18em] text-f1-text-muted">
                Powered by <span className="text-f1-accent">OpenF1</span>
              </p>
              <h1 className="sr-only">Undercut</h1>
              <Image
                src="/logo.svg"
                alt="Undercut"
                width={520}
                height={140}
                loading="eager"
                className="mt-4 h-auto w-full max-w-[22rem] drop-shadow-[0_0_34px_rgba(110,162,244,0.18)] sm:max-w-[30rem] lg:max-w-[34rem]"
              />
              <p className="mt-6 max-w-2xl text-lg leading-8 text-f1-text-secondary sm:text-xl">
                A race command center for live timing, replay, standings, weather, strategy, and the context that makes a session readable at speed.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <MagneticLink
                  href="/live"
                  className="premium-focus group inline-flex items-center gap-2 rounded-lg bg-f1-accent px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-accent)] transition duration-300 ease-premium hover:translate-y-[-1px] hover:bg-f1-accent-hover"
                >
                  <Timer size={16} />
                  Open Timing
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </MagneticLink>
                <MagneticLink
                  href="/calendar"
                  className="premium-focus inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.05] px-5 py-3 text-sm font-semibold text-f1-text shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-xl transition duration-300 ease-premium hover:border-white/[0.14] hover:bg-white/[0.08]"
                >
                  <CalendarDays size={16} />
                  Season Calendar
                </MagneticLink>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.12 }}
              onPointerMove={updateSpotlight}
              className="linear-surface rounded-2xl p-4 backdrop-blur-2xl"
            >
              <div className="relative z-10 flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-f1-text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-f1-success shadow-[0_0_14px_rgba(0,210,190,0.8)]" />
                    Season Pulse
                  </div>
                  <p className="mt-2 text-sm font-medium text-f1-text">
                    {new Date().getFullYear()} Formula 1 Calendar
                  </p>
                  <p className="mt-1 text-xs text-f1-text-muted">
                    Live race cadence, progress, and next window
                  </p>
                </div>
                <div className="rounded-xl border border-f1-success/20 bg-f1-success/10 p-2 text-f1-success shadow-[0_0_24px_rgba(0,210,190,0.08)]">
                  <Activity size={16} />
                </div>
              </div>

              {isLoading ? (
                <div className="relative z-10 mt-4 space-y-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-24" />
                </div>
              ) : (
                <div className="relative z-10 mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-f1-text-muted">Races</p>
                      <p className="mt-1 text-2xl font-semibold text-f1-text">{meetings?.length ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-f1-text-muted">Done</p>
                      <p className="mt-1 text-2xl font-semibold text-f1-text">{completedRaces.length}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-f1-text-muted">Left</p>
                      <p className="mt-1 text-2xl font-semibold text-f1-text">{upcomingRaces.length}</p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-f1-text-muted">
                      <span>Season completion</span>
                      <span>{completion}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${completion}%` }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-f1-accent-muted via-f1-accent to-f1-success shadow-[0_0_18px_rgba(110,162,244,0.42)]"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {latestRace && (
                      <Link href="/live" className="premium-focus group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 transition duration-300 ease-premium hover:-translate-y-0.5 hover:border-f1-success/45 hover:bg-f1-success/10">
                        <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 origin-bottom scale-y-0 bg-f1-success transition-transform duration-300 group-hover:scale-y-100" />
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-f1-success">
                          <Flag size={13} />
                          Latest classified session
                        </div>
                        <p className="mt-2 text-base font-semibold text-f1-text">{latestRace.meeting_name}</p>
                        <p className="mt-1 text-sm text-f1-text-secondary">{latestRace.location}, {latestRace.country_name}</p>
                      </Link>
                    )}
                    {nextRace && (
                      <Link href="/calendar" className="premium-focus group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 transition duration-300 ease-premium hover:-translate-y-0.5 hover:border-f1-accent/45 hover:bg-f1-accent/10">
                        <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 origin-bottom scale-y-0 bg-f1-accent transition-transform duration-300 group-hover:scale-y-100" />
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-f1-accent">
                          <CalendarDays size={13} />
                          Next race window
                        </div>
                        <p className="mt-2 text-base font-semibold text-f1-text">{nextRace.meeting_name}</p>
                        <p className="mt-1 text-sm text-f1-text-secondary">
                          {formatDistanceToNow(parseISO(nextRace.date_start), { addSuffix: true })}
                        </p>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        <section className="relative z-10 mx-auto grid max-w-7xl gap-4 px-5 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {capabilities.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                onPointerMove={updateSpotlight}
                className="linear-surface surface-sheen group rounded-2xl p-5 transition duration-300 ease-premium hover:-translate-y-1"
              >
                <div className="relative z-10 mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-f1-accent-light text-f1-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_28px_rgba(110,162,244,0.12)] transition duration-300 ease-premium group-hover:scale-[1.03]">
                  <Icon size={18} />
                </div>
                <h2 className="relative z-10 text-base font-semibold text-f1-text">{item.label}</h2>
                <p className="relative z-10 mt-2 text-sm leading-6 text-f1-text-secondary">{item.value}</p>
              </motion.div>
            );
          })}
        </section>
    </div>
  );
}
