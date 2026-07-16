/**
 * Dependency-free SVG bar chart for the finance dashboard (Issue #154).
 *
 * Server component — no interactivity. Accessibility: the chart is a labelled
 * `role="img"`, every bar carries a `<title>` (native tooltip), and a visually
 * hidden data table exposes every value as text (values are never encoded by
 * length/color alone). Numbers use the de-CH format. Colors are deliberately
 * muted (slate + a single restrained accent per chart), passed as hex so they
 * survive Tailwind's purge (no dynamic `fill-*` class names).
 */

interface ChartDatum {
  label: string
  value: number
  /** Optional comparison value (e.g. prior-year), rendered as a ghost bar. */
  secondary?: number
}

interface DashboardBarChartProps {
  /** Accessible chart title / summary. */
  title: string
  data: ChartDatum[]
  /** Formats a value for tooltips and the hidden table (e.g. "CHF 1'234.50"). */
  formatValue: (value: number) => string
  /** Primary bar color (hex). */
  color: string
  /** Legend label for the primary series. */
  seriesLabel: string
  /** Legend label for the comparison series; enables the ghost bars. */
  secondaryLabel?: string
}

// SVG coordinate system (scales horizontally via viewBox; height stays sane).
const PAD_LEFT = 46
const PAD_RIGHT = 10
const PAD_TOP = 14
const PLOT_H = 150
const LABEL_H = 30
const SLOT_W = 46
const SECONDARY_COLOR = "#cbd5e1" // slate-300 — muted comparison ghost
const AXIS_COLOR = "#e2e8f0" // slate-200 gridlines
const AXIS_TEXT = "#64748b" // slate-500

/** Round a value up to a "nice" axis maximum (1/2/5 × 10ⁿ). */
function niceCeil(value: number): number {
  if (value <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

/** Compact axis tick label: rounded integer with de-CH grouping. */
function formatTick(value: number): string {
  return Math.round(value).toLocaleString("de-CH", { maximumFractionDigits: 0 })
}

export function DashboardBarChart({
  title,
  data,
  formatValue,
  color,
  seriesLabel,
  secondaryLabel,
}: DashboardBarChartProps) {
  const hasSecondary = secondaryLabel !== undefined
  const rawMax = data.reduce(
    (max, d) => Math.max(max, d.value, hasSecondary ? (d.secondary ?? 0) : 0),
    0
  )
  const maxValue = niceCeil(rawMax)

  const viewW = PAD_LEFT + data.length * SLOT_W + PAD_RIGHT
  const viewH = PAD_TOP + PLOT_H + LABEL_H
  const baseY = PAD_TOP + PLOT_H

  const yFor = (value: number): number =>
    baseY - PLOT_H * Math.min(value / maxValue, 1)

  const gridLevels = [0, 0.5, 1]

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-900">{title}</span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <LegendSwatch color={color} label={seriesLabel} />
          {hasSecondary && (
            <LegendSwatch color={SECONDARY_COLOR} label={secondaryLabel!} />
          )}
        </span>
      </figcaption>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          className="h-auto w-full min-w-[520px]"
          role="img"
          aria-label={title}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Gridlines + y-axis labels */}
          {gridLevels.map((level) => {
            const y = baseY - PLOT_H * level
            const tickValue = maxValue * level
            return (
              <g key={level}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={viewW - PAD_RIGHT}
                  y2={y}
                  stroke={AXIS_COLOR}
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill={AXIS_TEXT}
                >
                  {formatTick(tickValue)}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {data.map((datum, index) => {
            const slotX = PAD_LEFT + index * SLOT_W
            const primaryTitle = `${datum.label}: ${formatValue(datum.value)}`

            if (hasSecondary) {
              const barW = 13
              const gap = 3
              const groupW = barW * 2 + gap
              const startX = slotX + (SLOT_W - groupW) / 2
              const secVal = datum.secondary ?? 0
              const secTitle = `${datum.label} ${secondaryLabel}: ${formatValue(secVal)}`
              return (
                <g key={datum.label}>
                  <rect
                    x={startX}
                    y={yFor(secVal)}
                    width={barW}
                    height={Math.max(baseY - yFor(secVal), 0)}
                    fill={SECONDARY_COLOR}
                    rx={1.5}
                  >
                    <title>{secTitle}</title>
                  </rect>
                  <rect
                    x={startX + barW + gap}
                    y={yFor(datum.value)}
                    width={barW}
                    height={Math.max(baseY - yFor(datum.value), 0)}
                    fill={color}
                    rx={1.5}
                  >
                    <title>{primaryTitle}</title>
                  </rect>
                  <text
                    x={slotX + SLOT_W / 2}
                    y={baseY + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill={AXIS_TEXT}
                  >
                    {datum.label}
                  </text>
                </g>
              )
            }

            const barW = 22
            const startX = slotX + (SLOT_W - barW) / 2
            return (
              <g key={datum.label}>
                <rect
                  x={startX}
                  y={yFor(datum.value)}
                  width={barW}
                  height={Math.max(baseY - yFor(datum.value), 0)}
                  fill={color}
                  rx={2}
                >
                  <title>{primaryTitle}</title>
                </rect>
                <text
                  x={slotX + SLOT_W / 2}
                  y={baseY + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill={AXIS_TEXT}
                >
                  {datum.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Visually hidden data table — full values as text for screen readers. */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Monat</th>
            <th scope="col">{seriesLabel}</th>
            {hasSecondary && <th scope="col">{secondaryLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.label}>
              <th scope="row">{datum.label}</th>
              <td>{formatValue(datum.value)}</td>
              {hasSecondary && <td>{formatValue(datum.secondary ?? 0)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
