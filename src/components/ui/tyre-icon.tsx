import { TIRE_COLORS } from "@/lib/utils/colors";

const COMPOUND_LABEL: Record<string, string> = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
  INTERMEDIATE: "I",
  WET: "W",
};

interface TyreIconProps {
  compound: string;
  size?: number;
  /** If provided, shows this label (e.g. "C3") instead of the compound letter */
  label?: string;
}

/**
 * F1-style tyre compound icon: dark tyre body, colored sidewall stripe ring,
 * compound letter (or custom label) centered.
 */
export function TyreIcon({ compound, size = 24, label }: TyreIconProps) {
  const color =
    TIRE_COLORS[compound.toUpperCase() as keyof typeof TIRE_COLORS] ??
    "#888888";
  const displayLabel =
    label ?? COMPOUND_LABEL[compound.toUpperCase()] ?? compound.charAt(0).toUpperCase();

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-label={compound}
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Tyre body */}
      <circle cx="16" cy="16" r="15.5" fill="#0d0d14" />
      {/* Outer tread edge */}
      <circle
        cx="16"
        cy="16"
        r="15.5"
        fill="none"
        stroke="#252530"
        strokeWidth="2.5"
      />
      {/* Colored sidewall stripe */}
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeOpacity="0.95"
      />
      {/* Inner rim */}
      <circle cx="16" cy="16" r="10.5" fill="#06060f" />
      <circle
        cx="16"
        cy="16"
        r="10.5"
        fill="none"
        stroke="#1e1e2a"
        strokeWidth="1"
      />
      {/* Compound label */}
      <text
        x="16"
        y="16"
        textAnchor="middle"
        dy="0.35em"
        fill={color}
        fontSize={label ? "9" : "14"}
        fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="-0.5"
      >
        {displayLabel}
      </text>
    </svg>
  );
}
