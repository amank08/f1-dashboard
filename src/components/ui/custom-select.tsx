"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectOption {
  value: string;
  label: string;
  /** URL to a flag/icon image */
  iconUrl?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  className,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-f1-border bg-f1-surface px-3 py-2 text-left text-sm font-semibold text-f1-text",
          "focus:border-f1-accent focus:outline-none focus:ring-1 focus:ring-f1-accent",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {selected ? (
          <>
            {selected.iconUrl && (
              <Image src={selected.iconUrl} alt="" width={20} height={14} className="h-3.5 w-5 object-cover rounded-[2px] shrink-0" />
            )}
            <span className="truncate">{selected.label}</span>
          </>
        ) : (
          <span className="text-f1-text-muted truncate">{placeholder}</span>
        )}
        <ChevronDown
          size={14}
          className={cn(
            "ml-auto shrink-0 text-f1-text-muted transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-f1-border bg-f1-surface shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                opt.value === value
                  ? "bg-f1-accent/10 text-f1-accent font-semibold"
                  : "text-f1-text hover:bg-f1-card"
              )}
            >
              {opt.iconUrl && (
                <Image src={opt.iconUrl} alt="" width={20} height={14} className="h-3.5 w-5 object-cover rounded-[2px] shrink-0" />
              )}
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
