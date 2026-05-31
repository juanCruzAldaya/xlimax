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

const SENSORS = Object.values(SENSOR_CONFIG)

/* ── Tooltip individual ── */
function SingleTooltip({ active, payload, label, sensorKey }) {
  if (!active || !payload?.length) return null
  const cfg = SENSOR_CONFIG[sensorKey]
  const val = payload[0]?.value
  const d   = new Date(label)
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__time">
        {d.toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="chart-tooltip__val" style={{ color: cfg.colorHex }}>
        {val != null ? `${val}${cfg.unit}` : '—'}
      </p>
    </div>
  )
}

/* ── Tooltip combinado ── */
function CombinedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = new Date(label)
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__time">
        {d.toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
      {payload.map(p => {
        const cfg = SENSOR_CONFIG[p.dataKey]
        if (!cfg || p.value == null) return null
        return (
          <p key={p.dataKey} className="chart-tooltip__val" style={{ color: cfg.colorHex }}>
            {cfg.label}: {p.value}{cfg.unit}
          </p>
        )
      })}
    </div>
  )
}

/* ── Range tabs ── */
function RangeTabs({ rangeIdx, onRangeChange }) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
      {RANGES.map((r, idx) => (
        <button
          key={r.label}
          onClick={() => onRangeChange(idx)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            rangeIdx === idx
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

/* ── Chart combinado (3 sensores) ── */
function CombinedChart({ data, rangeIdx, onRangeChange }) {
  const rangePoints = RANGES[rangeIdx]?.points ?? 288

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-bold text-slate-800">Temperatura · Humedad · Luminosidad</h3>
          <p className="text-xs text-slate-400 mt-0.5">Evolución combinada de todos los sensores</p>
        </div>
        <RangeTabs rangeIdx={rangeIdx} onRangeChange={onRangeChange} />
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
            <defs>
              {SENSORS.map(cfg => (
                <linearGradient key={cfg.gradId} id={`${cfg.gradId}-c`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cfg.colorHex} stopOpacity={0.18} />
                  <stop offset="85%" stopColor={cfg.colorHex} stopOpacity={0}    />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="epoch" type="number" scale="time"
              domain={['dataMin', 'dataMax']}
              tickCount={7}
              tickFormatter={e => formatEpoch(e, rangePoints)}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false} tickLine={false}
            />

            {/* Eje izquierdo — Temperatura (°C) */}
            <YAxis
              yAxisId="temp"
              tick={{ fill: '#f97316', fontSize: 10 }}
              axisLine={false} tickLine={false} width={38}
              tickFormatter={v => `${v}°`}
            />

            {/* Eje derecho — Humedad y Luz (%) */}
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false} tickLine={false} width={32}
              tickFormatter={v => `${v}%`}
            />

            <Tooltip content={<CombinedTooltip />}
              cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />

            <Area yAxisId="temp" type="monotone" dataKey="t"
              stroke="#f97316" strokeWidth={2.5}
              fill="url(#grad-t-c)" dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#f97316' }}
              isAnimationActive={false} />

            <Area yAxisId="pct" type="monotone" dataKey="h"
              stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 3"
              fill="url(#grad-h-c)" dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }}
              isAnimationActive={false} />

            <Area yAxisId="pct" type="monotone" dataKey="l"
              stroke="#f59e0b" strokeWidth={2}
              fill="url(#grad-l-c)" dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#f59e0b' }}
              isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div className="flex gap-6 mt-4 justify-center flex-wrap">
        {SENSORS.map(cfg => (
          <div key={cfg.key} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-full" style={{ background: cfg.colorHex }} />
            {cfg.label}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Chart individual ── */
function SingleChart({ data, sensorKey, rangeIdx, onRangeChange }) {
  const cfg         = SENSOR_CONFIG[sensorKey]
  const rangePoints = RANGES[rangeIdx]?.points ?? 288

  const vals    = data.map(d => d[sensorKey]).filter(v => v != null)
  const dataMin = vals.length ? Math.min(...vals) : 0
  const dataMax = vals.length ? Math.max(...vals) : 100
  const pad     = (dataMax - dataMin) * 0.15 || 1
  const yDomain = [+(dataMin - pad).toFixed(1), +(dataMax + pad).toFixed(1)]

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-bold text-slate-800">Tendencia — {cfg.label}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Evolución temporal del sensor</p>
        </div>
        <RangeTabs rangeIdx={rangeIdx} onRangeChange={onRangeChange} />
      </div>

      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={cfg.gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={cfg.colorHex} stopOpacity={0.2} />
                <stop offset="85%" stopColor={cfg.colorHex} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="epoch" type="number" scale="time"
              domain={['dataMin', 'dataMax']}
              tickCount={7}
              tickFormatter={e => formatEpoch(e, rangePoints)}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false} tickLine={false} width={44}
              tickFormatter={v => `${v}${cfg.unit}`}
            />
            <Tooltip content={<SingleTooltip sensorKey={sensorKey} />}
              cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
            <Area
              type="monotone" dataKey={sensorKey}
              stroke={cfg.colorHex} strokeWidth={2.5}
              fill={`url(#${cfg.gradId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: cfg.colorHex }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2 mt-4 justify-center">
        <span className="w-3 h-3 rounded-full" style={{ background: cfg.colorHex }} />
        <span className="text-xs text-slate-500">{cfg.label}</span>
      </div>
    </div>
  )
}

/* ── Export principal ── */
export default function ChartPanel({ data, sensorKey, rangeIdx, onRangeChange }) {
  if (sensorKey === 'combined') {
    return <CombinedChart data={data} rangeIdx={rangeIdx} onRangeChange={onRangeChange} />
  }
  return <SingleChart data={data} sensorKey={sensorKey} rangeIdx={rangeIdx} onRangeChange={onRangeChange} />
}
