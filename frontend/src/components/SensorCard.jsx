import { useMemo } from 'react'
import { Thermometer, Droplets, Sun, Wind, Mountain, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'
import { SENSOR_CONFIG, calcStats } from '../data/mockData'

const ICONS = {
  t: Thermometer,
  h: Droplets,
  l: Sun,
  p: Wind,
  a: Mountain,
}

export default function SensorCard({ sensorKey, data, rangePoints, active, onClick }) {
  const cfg    = SENSOR_CONFIG[sensorKey]
  const Icon   = ICONS[sensorKey] ?? Minus

  const sparkData = useMemo(() => data.slice(-12), [data])
  const rangeData = useMemo(() => data.slice(-rangePoints), [data, rangePoints])
  const stats     = useMemo(() => calcStats(rangeData, sensorKey), [rangeData, sensorKey])

  const currentVal = data[data.length - 1]?.[sensorKey]
  const current    = currentVal != null ? (+currentVal).toFixed(2) : '—'
  const prev       = data[data.length - 3]?.[sensorKey]
  const delta      = currentVal != null && prev != null ? +(currentVal - prev).toFixed(1) : null

  const TrendIcon = delta == null ? Minus : delta > 0.2 ? TrendingUp : delta < -0.2 ? TrendingDown : Minus
  const trendColor = delta == null ? 'text-slate-400'
    : delta > 0.2  ? 'text-rose-500'
    : delta < -0.2 ? 'text-emerald-500'
    : 'text-slate-400'

  const domainPad = ((stats.max ?? 0) - (stats.min ?? 0)) * 0.2 || 1
  const yDomain   = [(stats.min ?? 0) - domainPad, (stats.max ?? 0) + domainPad]

  return (
    <div
      onClick={onClick}
      className={`bg-white p-5 rounded-3xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer ${
        active ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-100'
      }`}
    >
      {/* Decorative circle */}
      <div className={`absolute -right-5 -top-5 w-20 h-20 rounded-full opacity-60 ${cfg.bgClass} transition-transform group-hover:scale-110`} />

      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className={`p-2.5 rounded-2xl ${cfg.bgClass}`}>
          <Icon size={20} className={cfg.textClass} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
          <TrendIcon size={13} />
          {delta != null && <span>{Math.abs(delta)}{cfg.unit}</span>}
        </div>
      </div>

      <div className="relative z-10 mb-3">
        <p className="text-slate-500 text-xs font-medium mb-1">{cfg.label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900">{current}</span>
          <span className="text-slate-400 text-sm font-medium">{cfg.unit}</span>
        </div>
      </div>

      <div className="h-10 relative z-10">
        <ResponsiveContainer width="100%" height={40}>
          <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${sensorKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={cfg.colorHex} stopOpacity={0.2} />
                <stop offset="95%" stopColor={cfg.colorHex} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <YAxis domain={yDomain} hide />
            <Area type="monotone" dataKey={sensorKey}
              stroke={cfg.colorHex} strokeWidth={2}
              fill={`url(#spark-${sensorKey})`}
              dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between mt-2 text-xs text-slate-400 relative z-10">
        <span>Mín: <strong className="text-slate-600">{stats.min}{cfg.unit}</strong></span>
        <span>Máx: <strong className="text-slate-600">{stats.max}{cfg.unit}</strong></span>
      </div>
    </div>
  )
}
