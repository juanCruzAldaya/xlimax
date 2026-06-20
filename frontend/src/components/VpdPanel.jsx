import { useMemo, useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts'
import { Gauge, Info, Loader2 } from 'lucide-react'
import { formatEpoch } from '../data/mockData'
import {
  vpdLeaf, vpdAir, classifyVpd,
  VPD_ZONES, VPD_MAX, LEAF_OFFSET_DEFAULT,
} from '../utils/vpd'

const RANGES = [
  { label: '1h',  hours: 1  },
  { label: '6h',  hours: 6  },
  { label: '24h', hours: 24 },
  { label: '3d',  hours: 72 },
]

const TEAL = '#14b8a6'

/* ── Tabs de rango ── */
function RangeTabs({ rangeIdx, onRangeChange }) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
      {RANGES.map((r, idx) => (
        <button key={r.label} onClick={() => onRangeChange(idx)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            rangeIdx === idx ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          {r.label}
        </button>
      ))}
    </div>
  )
}

/* ── Barra-gauge con zonas por etapa y marcador del valor actual ── */
function ZoneGauge({ value }) {
  const pos = value != null ? Math.min(Math.max(value, 0), VPD_MAX) / VPD_MAX * 100 : null
  return (
    <div className="pt-2">
      <div className="relative h-3.5 rounded-full overflow-hidden flex">
        {VPD_ZONES.filter(z => z.min < VPD_MAX).map(z => (
          <div key={z.min} style={{
            flexGrow: Math.min(z.max, VPD_MAX) - z.min,
            background: z.color,
          }} />
        ))}
      </div>
      {pos != null && (
        <div className="relative h-0" style={{ marginLeft: `${pos}%` }}>
          <div className="absolute -translate-x-1/2 -top-[18px]">
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-800" />
          </div>
        </div>
      )}
      <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-mono">
        <span>0</span><span>0.4</span><span>0.8</span><span>1.2</span><span>1.6</span><span>2.0</span>
      </div>
    </div>
  )
}

/* ── Tooltip del chart ── */
function VpdTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const raw = payload[0]?.payload ?? {}
  const d   = new Date(label)
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__time">
        {d.toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="chart-tooltip__val" style={{ color: TEAL }}>
        VPD foliar: {raw.v != null ? `${raw.v} kPa` : '—'}
      </p>
      <p className="chart-tooltip__val" style={{ color: '#64748b' }}>
        VPD aire: {raw.vair != null ? `${raw.vair} kPa` : '—'}
      </p>
    </div>
  )
}

export default function VpdPanel({ data, rangeIdx, onRangeChange, loading }) {
  const [offset, setOffset] = useState(LEAF_OFFSET_DEFAULT)
  const rangeHours = RANGES[rangeIdx]?.hours ?? 24

  // Recalcula VPD con el offset elegido (a partir de t/h de cada punto)
  const series = useMemo(() => data.map(d => ({
    epoch: d.epoch,
    v:    vpdLeaf(d.t, d.h, offset),
    vair: vpdAir(d.t, d.h),
  })), [data, offset])

  const last    = useMemo(() => [...series].reverse().find(d => d.v != null), [series])
  const current = last?.v ?? null
  const air     = last?.vair ?? null
  const zone    = classifyVpd(current)

  const vals = series.map(d => d.v).filter(v => v != null)
  const maxV = vals.length ? Math.max(...vals) : 1.6
  const minV = vals.length ? Math.min(...vals) : 0
  const yMax = +(Math.max(1.8, maxV + 0.2)).toFixed(1)
  const yMin = minV < 0 ? +(minV - 0.1).toFixed(1) : 0

  return (
    <div className="space-y-6">

      {/* Hero — valor actual + gauge */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Valor + etapa */}
          <div className="lg:w-72 flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-500"><Gauge size={18} /></div>
              <span className="text-sm font-semibold text-slate-600">VPD foliar actual</span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-5xl font-bold text-slate-900">{current != null ? current.toFixed(2) : '—'}</span>
              <span className="text-slate-400 text-lg font-medium">kPa</span>
            </div>
            {zone && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold"
                style={{ background: `${zone.color}1a`, color: zone.color }}>
                <span className="w-2 h-2 rounded-full" style={{ background: zone.color }} />
                {current < 0 ? 'Condensación' : zone.label} · {zone.stage}
              </div>
            )}
            {current < 0 && (
              <p className="text-xs text-blue-500 mt-2">Hoja en/bajo punto de rocío — condensación</p>
            )}
            <p className="text-xs text-slate-400 mt-3">
              VPD de aire: <strong className="text-slate-600">{air != null ? `${air.toFixed(2)} kPa` : '—'}</strong>
            </p>
          </div>

          {/* Gauge + offset */}
          <div className="flex-1 flex flex-col justify-center">
            <ZoneGauge value={current} />
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4">
              {VPD_ZONES.filter(z => z.min < VPD_MAX).map(z => (
                <div key={z.min} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: z.color }} />
                  {z.label} <span className="text-slate-300">({z.min}–{z.max})</span>
                </div>
              ))}
            </div>

            {/* Offset foliar */}
            <div className="mt-5 flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                Offset hoja −{offset.toFixed(1)}°C
              </span>
              <input type="range" min="0" max="4" step="0.5" value={offset}
                onChange={e => setOffset(+e.target.value)}
                className="flex-1 accent-teal-500" />
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Info size={12} /> hoja = aire − offset
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart con bandas de zonas */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="font-bold text-slate-800">Evolución del VPD</h3>
            <p className="text-xs text-slate-400 mt-0.5">Foliar (relleno) vs aire (línea) — bandas = zonas objetivo</p>
          </div>
          <RangeTabs rangeIdx={rangeIdx} onRangeChange={onRangeChange} />
        </div>

        <div className="h-72">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={26} className="animate-spin" />
              <span className="text-sm">Cargando histórico…</span>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-v-panel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={TEAL} stopOpacity={0.25} />
                  <stop offset="90%" stopColor={TEAL} stopOpacity={0}    />
                </linearGradient>
              </defs>

              {/* Banda de condensación (VPD < 0) */}
              {yMin < 0 && (
                <ReferenceArea y1={yMin} y2={0}
                  fill="#3b82f6" fillOpacity={0.1} strokeOpacity={0} ifOverflow="hidden" />
              )}
              {/* Bandas de zonas como fondo */}
              {VPD_ZONES.filter(z => z.min < yMax).map(z => (
                <ReferenceArea key={z.min} y1={z.min} y2={Math.min(z.max, yMax)}
                  fill={z.color} fillOpacity={0.06} strokeOpacity={0} ifOverflow="hidden" />
              ))}
              {yMin < 0 && (
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
              )}

              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="epoch" type="number" scale="time"
                domain={['dataMin', 'dataMax']} tickCount={7}
                tickFormatter={e => formatEpoch(e, rangeHours)}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                domain={[yMin, yMax]} tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false} tickLine={false} width={44}
                tickFormatter={v => `${v}`}
              />
              <Tooltip content={<VpdTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />

              <Area type="monotone" dataKey="v" name="foliar"
                stroke={TEAL} strokeWidth={2.5} fill="url(#grad-v-panel)"
                dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: TEAL }}
                isAnimationActive={false} />
              <Line type="monotone" dataKey="vair" name="aire"
                stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3"
                dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="flex gap-6 mt-4 justify-center text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: TEAL }} /> VPD foliar
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0 border-t-2 border-dashed border-slate-400" /> VPD aire
          </div>
        </div>
      </div>
    </div>
  )
}
