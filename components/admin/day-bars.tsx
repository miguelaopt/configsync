/**
 * One series of daily counts as columns: accent fill, 2px gaps, 4px rounded tops on one
 * baseline. Hover or focus a column for its day and value; the table is for screen readers.
 */
export function DayBars({
  days,
  label,
  unit,
}: {
  days: { day: string; n: number }[];
  label: string;
  unit: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.n));
  const total = days.reduce((s, d) => s + d.n, 0);
  const fmt = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-[12px] text-ink-3">
        <span className="tnum">max {max.toLocaleString("en")}</span>
        <span className="tnum">
          {total.toLocaleString("en")} {unit} in {days.length} days
        </span>
      </div>
      <div aria-hidden className="flex h-32 items-end gap-[2px] border-b border-line">
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-6 rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80"
              style={{ height: d.n ? `${Math.max(2, (d.n / max) * 100)}%` : 0 }}
            />
            <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md border border-line bg-overlay px-2 py-1 text-[12px] whitespace-nowrap text-ink shadow-dialog group-hover:block">
              {fmt(d.day)} · <span className="tnum">{d.n.toLocaleString("en")}</span> {unit}
            </span>
          </div>
        ))}
      </div>
      <div aria-hidden className="flex justify-between text-[12px] text-ink-3">
        <span>{fmt(days[0]!.day)}</span>
        <span>{fmt(days.at(-1)!.day)}</span>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
