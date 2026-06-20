import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { History, Calendar, Loader2, AlertCircle, Database } from 'lucide-react'
import { SENSOR_CONFIG, formatEpoch } from '../data/mockData'
import { fetchHistory } from '../services/history'

/* Presets: cada uno define ventana + granularidad del bucket */
const PRESETS = [
  { label: '24h', hours: 24,       bucket: 'hour' },
  { label: '3d',  hours: 72,       bucket: 'hour' },
  { label: '7d',  hours: 168,      bucket: 'hour' },
  { label: '30d', hours: 24 * 30,  bucket: 'day'  },
]

const SENSOR_KEYS = ['t', 'h', 'v', 'l', 'p', 'a']

/* yyyy-mm-dd local para <input type="date"> */
function toDateInput(epoch) {
  const d = new Date(epoch)
  const off = d.getTimezoneOffset() * 60000
  return new Date(epoch - off).toISOString().slice(0, 10)
}

function HistTooltip({ active, payload, label, cfg, bucket }) {
  if (!active || !payload?.length) return null
  const d = new Date(label)
  const val = payload[0]?.value
  const fmt = bucket === 'day'
    ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
    : d.toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__time">{fmt}</p>
      <p className="chart-tooltip__val" style={{ color: cfg.colorHex }}>
        {val != null ? `${val}${cfg.unit}` : '—'} <span className="text-slate-400">(prom.)</span>
      </p>
    </div>
  )
}

export default function HistoryPanel({ availableNodes }) {
  const nodes = availableNodes.length > 0 ? availableNodes : ['interior']

  const [presetIdx,  setPresetIdx]  = useState(2)        // default: 7d
  const [node,       setNode]       = useState(nodes[0])
  const [sensor,     setSensor]     = useState('t')
  const [fromStr,    setFromStr]    = useState(toDateInput(Date.now() - 7 * 86400000))
  const [toStr,      setToStr]      = useState(toDateInput(Date.now()))

  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  // Mantiene un nodo válido cuando llegan los nodos reales
  useEffect(() => {
    if (!nodes.includes(node)) setNode(nodes[0])
  }, [nodes, node])

  const load = useCallback(async (fromEpoch, toEpoch, bucket) => {
    setLoading(true); setError(null)
    try {
      const data = await fetchHistory(fromEpoch, toEpoch, bucket)
      setResult(data)
    } catch (e) {
      setError(e.message || 'Error al cargar el histórico')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial (preset por defecto)
  useEffect(() => {
    const p = PRESETS[presetIdx]
    load(Date.now() - p.hours * 3600000, Date.now(), p.bucket)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePreset(idx) {
    setPresetIdx(idx)
    const p = PRESETS[idx]
    const to = Date.now()
    const from = to - p.hours * 3600000
    setFromStr(toDateInput(from)); setToStr(toDateInput(to))
    load(from, to, p.bucket)
  }

  function handleCustom() {
    const from = new Date(`${fromStr}T00:00:00`).getTime()
    const to   = new Date(`${toStr}T23:59:59`).getTime()
    if (isNaN(from) || isNaN(to) || from >= to) {
      setError('Rango de fechas inválido'); return
    }
    const spanDays = (to - from) / 86400000
    const bucket = spanDays <= 8 ? 'hour' : 'day'
    setPresetIdx(-1)
    load(from, to, bucket)
  }

  const cfg = SENSOR_CONFIG[sensor]

  const chartData = useMemo(() => {
    if (!result) return []
    return result.points.map(p => ({ epoch: p.epoch, value: p.nodes?.[node]?.[sensor] ?? null }))
  }, [result, node, sensor])

  const stats = useMemo(() => {
    const vals = chartData.map(d => d.value).filter(v => v != null)
    if (!vals.length) return null
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return {
      min: +Math.min(...vals).toFixed(2),
      max: +Math.max(...vals).toFixed(2),
      avg: +avg.toFixed(2),
      n: vals.length,
    }
  }, [chartData])

  const vals    = chartData.map(d => d.value).filter(v => v != null)
  const dataMin = vals.length ? Math.min(...vals) : 0
  const dataMax = vals.length ? Math.max(...vals) : 1
  const pad     = (dataMax - dataMin) * 0.15 || 1
  const yDomain = [+(dataMin - pad).toFixed(2), +(dataMax + pad).toFixed(2)]

  const bucketLabel = result?.bucket === 'day' ? 'día' : 'hora'

  return (
    <div className="space-y-6">

      {/* Controles */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">

        {/* Presets + rango de fechas */}
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1.5">Rango rápido</p>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-min">
              {PRESETS.map((p, idx) => (
                <button key={p.label} onClick={() => handlePreset(idx)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    presetIdx === idx ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1.5">Desde</p>
              <input type="date" value={fromStr} onChange={e => setFromStr(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1.5">Hasta</p>
              <input type="date" value={toStr} onChange={e => setToStr(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </div>
            <button onClick={handleCustom}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors">
              <Calendar size={15} /> Aplicar
            </button>
          </div>
        </div>

        {/* Selectores de nodo y sensor */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
          {nodes.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Sector:</span>
              <div className="flex gap-1.5">
                {nodes.map(n => (
                  <button key={n} onClick={() => setNode(n)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                      node === n ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Sensor:</span>
            <div className="flex gap-1.5 flex-wrap">
              {SENSOR_KEYS.map(k => (
                <button key={k} onClick={() => setSensor(k)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    sensor === k ? 'text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  style={sensor === k ? { background: SENSOR_CONFIG[k].colorHex } : undefined}>
                  {SENSOR_CONFIG[k].labelShort}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resumen */}
      {result && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Mínimo',   value: stats ? `${stats.min}${cfg.unit}` : '—', color: cfg.colorHex },
            { label: 'Máximo',   value: stats ? `${stats.max}${cfg.unit}` : '—', color: cfg.colorHex },
            { label: 'Promedio', value: stats ? `${stats.avg}${cfg.unit}` : '—' },
            { label: `Puntos (×${bucketLabel})`, value: result.points.length },
          ].map(s => (
            <div key={s.label} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2">{s.label}</p>
              <span className="text-2xl font-bold" style={{ color: s.color ?? '#1e293b' }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-500"><History size={18} /></div>
            <div>
              <h3 className="font-bold text-slate-800">Histórico — {cfg.label}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Promedio por {bucketLabel}
                {result && ` · ${result.totalDocs.toLocaleString('es-AR')} lecturas agregadas`}
              </p>
            </div>
          </div>
        </div>

        <div className="h-80">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-sm">Cargando histórico…</span>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-rose-400 gap-2 text-center px-4">
              <AlertCircle size={28} />
              <span className="text-sm font-medium">{error}</span>
              <span className="text-xs text-slate-400">¿El backend de Render está despierto? (free tier duerme tras inactividad)</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
              <Database size={28} />
              <span className="text-sm">Sin datos en este rango</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-hist-${sensor}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={cfg.colorHex} stopOpacity={0.2} />
                    <stop offset="90%" stopColor={cfg.colorHex} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="epoch" type="number" scale="time"
                  domain={['dataMin', 'dataMax']} tickCount={8}
                  tickFormatter={e => formatEpoch(e, result?.bucket === 'day' ? 9999 : 72)}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={yDomain} tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false} tickLine={false} width={48}
                  tickFormatter={v => `${v}${cfg.unit}`}
                />
                <Tooltip content={<HistTooltip cfg={cfg} bucket={result?.bucket} />}
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="value"
                  stroke={cfg.colorHex} strokeWidth={2.5}
                  fill={`url(#grad-hist-${sensor})`} dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: cfg.colorHex }}
                  isAnimationActive={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
