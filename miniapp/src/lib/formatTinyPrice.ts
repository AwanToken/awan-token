/** Unicode subscript digits for Gecko-style tiny prices (0.0₆2756). */
const SUB = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"] as const;

function toSubscript(n: number): string {
  return String(Math.max(0, Math.floor(n)))
    .split("")
    .map((d) => SUB[Number(d)] ?? d)
    .join("");
}

/**
 * Format prices that would otherwise collapse to 0.000000 with toFixed(6).
 * Tiny values (< 1e-4) use Gecko-style subscript zeros: 0.0₆2756
 */
export function formatTinyPrice(value: number, significant = 4): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const neg = value < 0;
  const v = Math.abs(value);
  const sign = neg ? "-" : "";

  if (v >= 1) {
    return (
      sign +
      v.toLocaleString("en-US", {
        maximumFractionDigits: Math.max(2, significant),
        minimumFractionDigits: 0,
      })
    );
  }

  if (v >= 1e-4) {
    const fixed = v.toFixed(Math.min(8, Math.max(4, significant + 2)));
    return sign + fixed.replace(/\.?0+$/, "");
  }

  const expStr = v.toExponential(Math.max(1, significant - 1));
  const [mantRaw, expRaw] = expStr.split("e");
  const exp = Number(expRaw);
  const zeros = -exp - 1;
  const digits = (mantRaw ?? "0").replace(".", "").replace(/0+$/, "") || "0";
  const sig = digits.slice(0, significant);

  if (zeros <= 0) {
    return sign + v.toFixed(significant);
  }
  if (zeros < 4) {
    return sign + v.toFixed(zeros + significant).replace(/0+$/, "").replace(/\.$/, "");
  }
  return `${sign}0.0${toSubscript(zeros)}${sig}`;
}

/** Compact USD / counts for metrics grid. */
export function formatUsd(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
  }
  if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
    return `$${formatTinyPrice(value, 4)}`;
  }
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length <= head + tail + 1) return addr || "—";
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
