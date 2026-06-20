import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { SENSOR_CONFIG, formatEpoch } from '../data/mockData'

/* Spinner mientras se baja el histórico (rangos largos) */
function ChartLoading() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
      <Loader2 size={26} className="animate-spin" />
      <span className="text-sm">Cargando histórico…</span>
    </div>
  )
}

const RANGES = [
  { label: '1h',  hours: 1  },
  { label: '6h',  hours: 6  },
  { label: '24h', hours: 24 },
  { label: '3d',  hours: 72 },
]

// Solo los 3 sensores del combined chart (normalizables a 0-100%)
const SENSORS_COMBINED = ['t', 'h', 'l'].map(k => SENSOR_CONFIG[k])

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

/* ── Tooltip combinado — muestra valores reales del punto original ── */
function CombinedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d   = new Date(label)
  const raw = payload[0]?.payload ?? {}
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__time">
        {d.toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
      {SENSORS_COMBINED.map(cfg => {
        const val = raw[cfg.key]
        if (val == null) return null
        return (
          <p key={cfg.key} className="chart-tooltip__val" style={{ color: cfg.colorHex }}>
            {cfg.label}: {val}{cfg.unit}
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

/* Normaliza los 3 sensores a escala 0–100 para que sean comparables en el mismo eje.
   Los valores reales se muestran en el tooltip, no en el eje Y. */
function normalizeData(data) {
  const tVals = data.map(d => d.t).filter(v => v != null)
  const lVals = data.map(d => d.l).filter(v => v != null)
  const tMin  = tVals.length ? Math.min(...tVals) : 0
  const tMax  = tVals.length ? Math.max(...tVals) : 40
  const lMax  = lVals.length ? Math.max(...lVals) : 1

  return data.map(d => ({
    ...d,
    t_n: d.t != null ? +((d.t - tMin) / (tMax - tMin || 1) * 100).toFixed(1) : null,
    h_n: d.h,
    l_n: d.l != null ? +(d.l / lMax * 100).toFixed(1) : null,
  }))
}

/* ── Chart combinado (3 sensores) ── */
function CombinedChart({ data, rangeIdx, onRangeChange, loading }) {
  const rangeHours = RANGES[rangeIdx]?.hours ?? 24
  const normalized = normalizeData(data)

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-bold text-slate-800">Temperatura · Humedad · Luminosidad</h3>
          <p className="text-xs text-slate-400 mt-0.5">Evolución combinada — escala normalizada 0–100%</p>
        </div>
        <RangeTabs rangeIdx={rangeIdx} onRangeChange={onRangeChange} />
      </div>

      <div className="h-64">
        {loading ? <ChartLoading /> : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={normalized} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {SENSORS_COMBINED.map(cfg => (
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
              tickFormatter={e => formatEpoch(e, rangeHours)}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false} tickLine={false}
            />

            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false} tickLine={false} width={36}
              tickFormatter={v => `${v}%`}
            />

            <Tooltip content={<CombinedTooltip />}
              cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />

            <Area type="monotone" dataKey="t_n"
              name="t"
              stroke="#ef4444" strokeWidth={2.5}
              fill="url(#grad-t-c)" dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#ef4444' }}
              isAnimationActive={false} />

            <Area type="monotone" dataKey="h_n"
              name="h"
              stroke="#06b6d4" strokeWidth={2} strokeDasharray="6 3"
              fill="url(#grad-h-c)" dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#06b6d4' }}
              isAnimationActive={false} />

            <Area type="monotone" dataKey="l_n"
              name="l"
              stroke="#84cc16" strokeWidth={2}
              fill="url(#grad-l-c)" dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#84cc16' }}
              isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex gap-6 mt-4 justify-center flex-wrap">
        {SENSORS_COMBINED.map(cfg => (
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
function SingleChart({ data, sensorKey, rangeIdx, onRangeChange, loading }) {
  const cfg         = SENSOR_CONFIG[sensorKey]
  const rangeHours = RANGES[rangeIdx]?.hours ?? 24

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
        {loading ? <ChartLoading /> : (
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
              tickFormatter={e => formatEpoch(e, rangeHours)}
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
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 justify-center">
        <span className="w-3 h-3 rounded-full" style={{ background: cfg.colorHex }} />
        <span className="text-xs text-slate-500">{cfg.label}</span>
      </div>
    </div>
  )
}

/* ── Export principal ── */
export default function ChartPanel({ data, sensorKey, rangeIdx, onRangeChange, loading }) {
  if (sensorKey === 'combined') {
    return <CombinedChart data={data} rangeIdx={rangeIdx} onRangeChange={onRangeChange} loading={loading} />
  }
  return <SingleChart data={data} sensorKey={sensorKey} rangeIdx={rangeIdx} onRangeChange={onRangeChange} loading={loading} />
}
