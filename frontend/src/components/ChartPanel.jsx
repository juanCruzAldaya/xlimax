import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { SENSOR_CONFIG, formatEpoch } from '../data/mockData'

const RANGES = [
  { label: '1h',  points: 12  },
  { label: '6h',  points: 72  },
  { label: '24h', points: 288 },
  { label: '3d',  points: 864 },
]

function CustomTooltip({ active, payload, label, sensorKey }) {
  if (!active || !payload?.length) return null
  const cfg = SENSOR_CONFIG[sensorKey]
  const val = payload[0]?.value
  const d = new Date(label)
  const timeStr = d.toLocaleString('es-AR', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__time">{timeStr}</span>
      <span className="chart-tooltip__val" style={{ color: cfg.colorHex }}>
        {val != null ? `${val}${cfg.unit}` : '—'}
      </span>
    </div>
  )
}

export default function ChartPanel({
  data, sensorKey, rangeIdx, onRangeChange,
}) {
  const cfg       = SENSOR_CONFIG[sensorKey]
  const rangePoints = RANGES[rangeIdx]?.points ?? 288

  const vals      = data.map(d => d[sensorKey])
  const dataMin   = Math.min(...vals)
  const dataMax   = Math.max(...vals)
  const pad       = (dataMax - dataMin) * 0.15 || 1
  const yDomain   = [+(dataMin - pad).toFixed(1), +(dataMax + pad).toFixed(1)]

  /* thin out ticks to avoid crowding */
  const tickCount = rangePoints <= 12 ? 6 : rangePoints <= 72 ? 7 : rangePoints <= 288 ? 8 : 9

  return (
    <div className="chart-panel">
      <div className="chart-panel__header">
        <div className="chart-panel__title">
          <div
            className="chart-panel__sensor-dot"
            style={{ background: cfg.colorHex }}
          />
          <span className="chart-panel__name">{cfg.label}</span>
          <span className="chart-panel__subtitle">— evolución temporal</span>
        </div>

        <div className="range-tabs">
          {RANGES.map((r, idx) => (
            <button
              key={r.label}
              className={`range-tab${rangeIdx === idx ? ' range-tab--active' : ''}`}
              onClick={() => onRangeChange(idx)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-panel__area">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={cfg.gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={cfg.colorHex} stopOpacity={0.25} />
                <stop offset="85%" stopColor={cfg.colorHex} stopOpacity={0}    />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.07)"
              vertical={false}
            />

            <XAxis
              dataKey="epoch"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickCount={tickCount}
              tickFormatter={e => formatEpoch(e, rangePoints)}
              tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: 'rgba(148,163,184,0.12)' }}
              tickLine={false}
            />

            <YAxis
              domain={yDomain}
              tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              width={46}
              tickFormatter={v => `${v}${cfg.unit}`}
            />

            <Tooltip
              content={<CustomTooltip sensorKey={sensorKey} />}
              cursor={{ stroke: 'rgba(148,163,184,0.2)', strokeWidth: 1 }}
            />

            <Area
              type="monotone"
              dataKey={sensorKey}
              stroke={cfg.colorHex}
              strokeWidth={1.8}
              fill={`url(#${cfg.gradId})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: cfg.colorHex }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
