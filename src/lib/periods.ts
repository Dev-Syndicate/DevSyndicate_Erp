// Report and dashboard periods (PRD §10, §27). The financial year runs April–March, so its quarters are the calendar quarters.

export const PERIODS = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "fy", label: "This financial year" },
  { value: "last_fy", label: "Last financial year" },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** From/to dates (YYYY-MM-DD) for a period containing `today` (YYYY-MM-DD, IST). Unknown periods mean this FY. */
export function periodRange(period: string | undefined, today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const fyStart = m >= 4 ? y : y - 1;
  switch (period) {
    case "month":
      return { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)) };
    case "quarter": {
      const first = m - ((m - 1) % 3);
      return { from: iso(y, first, 1), to: iso(y, first + 2, lastDay(y, first + 2)) };
    }
    case "last_fy":
      return { from: iso(fyStart - 1, 4, 1), to: iso(fyStart, 3, 31) };
    default:
      return { from: iso(fyStart, 4, 1), to: iso(fyStart + 1, 3, 31) };
  }
}
