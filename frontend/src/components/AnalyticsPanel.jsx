import { useMemo, useState, useEffect } from 'react'
import { FileText, Table, Database } from 'lucide-react'
import { SENSOR_CONFIG } from '../data/mockData'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'https://xlimax.onrender.com'

const SENSORS = ['t', 'h', 'l', 'p', 'a']

/* ── Helpers de exportación ── */
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function toCSV(data, nodes) {
  const nodeHeaders = nodes.flatMap(n => [
    `${n}_temp_C`, `${n}_hum_%`, `${n}_luz`, `${n}_presion_hPa`, `${n}_altitud_m`
  ])
  const headers = ['timestamp_utc', 'timestamp_art', ...nodeHeaders]

  const rows = data.map(d => {
    const utc = new Date(d.epoch)
    const art = new Date(d.epoch - 3 * 60 * 60 * 1000)
    const cols = [
      utc.toISOString(),
      art.toLocaleString('es-AR'),
      ...nodes.flatMap(n => {
        const s = d.nodes?.[n] ?? {}
        return [s.t ?? '', s.h ?? '', s.l ?? '', s.p ?? '', s.a ?? '']
      }),
    ]
    return cols.join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

function toHTML(data, nodes, rangeLabel, globalStats) {
  const nodeHeaders = nodes.flatMap(n => [
    `${n} T°C`, `${n} H%`, `${n} Luz`, `${n} Presión`, `${n} Altitud`
  ])

  const statsRows = SENSORS.map(key => {
    const cfg = SENSOR_CONFIG[key]
    return `<tr>
      <td><strong>${cfg.label}</strong></td>
      ${nodes.map(n => {
        const vals = data.map(d => d.nodes?.[n]?.[key]).filter(v => v != null)
        if (!vals.length) return '<td colspan="4" style="color:#94a3b8">Sin datos</td>'
        const min = Math.min(...vals).toFixed(2)
        const max = Math.max(...vals).toFixed(2)
        const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
        return `<td>${min}${cfg.unit}</td><td>${max}${cfg.unit}</td><td>${avg}${cfg.unit}</td>`
      }).join('')}
    </tr>`
  }).join('')

  const dataRows = data.slice(-200).map(d => {
    const art = new Date(d.epoch - 3 * 60 * 60 * 1000)
    return `<tr>
      <td>${art.toLocaleString('es-AR')}</td>
      ${nodes.flatMap(n => {
        const s = d.nodes?.[n] ?? {}
        return [s.t, s.h, s.l, s.p, s.a].map(v =>
          `<td>${v != null ? v : '—'}</td>`
        )
      }).join('')}
    </tr>`
  }).join('')

  const statsHeaders = nodes.flatMap(n => [
    `<th colspan="3">${n}</th>`
  ]).join('')
  const statsSubHeaders = nodes.flatMap(() =>
    ['<th>Mín</th><th>Máx</th><th>Prom</th>']
  ).join('')

  const globalRow = globalStats ? `
    <p>Total histórico en Firestore: <span class="badge">${globalStats.total?.toLocaleString('es-AR')} registros</span>
    &nbsp; Desde ayer: <span class="badge">${globalStats.desde_ayer?.toLocaleString('es-AR')} registros</span></p>` : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>XLIMAX — Exportación ${rangeLabel}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; color: #1e293b; padding: 32px; max-width: 1200px; margin: 0 auto; }
  h1 { color: #0f172a; font-size: 1.5rem; }
  h2 { color: #475569; font-size: 1rem; margin-top: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.85rem; }
  th { background: #f8fafc; color: #64748b; font-weight: 600; padding: 8px 12px; text-align: left; border: 1px solid #e2e8f0; }
  td { padding: 6px 12px; border: 1px solid #f1f5f9; }
  tr:nth-child(even) { background: #f8fafc; }
  .badge { display: inline-block; background: #e0f2fe; color: #0284c7; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; font-weight: 600; }
  footer { margin-top: 40px; color: #94a3b8; font-size: 0.75rem; text-align: center; }
</style>
</head>
<body>
<h1>📊 XLIMAX — Reporte de datos</h1>
<p>Período: <span class="badge">${rangeLabel}</span> &nbsp; Registros en rango: <span class="badge">${data.length}</span> &nbsp; Nodos: <span class="badge">${nodes.join(', ')}</span></p>
${globalRow}

<h2>Estadísticas del período</h2>
<table>
  <thead>
    <tr><th>Sensor</th>${statsHeaders}</tr>
    <tr><th></th>${statsSubHeaders}</tr>
  </thead>
  <tbody>${statsRows}</tbody>
</table>

<h2>Lecturas (últimas 200)</h2>
<table>
  <thead>
    <tr>
      <th>Timestamp ART</th>
      ${nodeHeaders.map(h => `<th>${h}</th>`).join('')}
    </tr>
  </thead>
  <tbody>${dataRows}</tbody>
</table>

<footer>Generado por XLIMAX · ${new Date().toLocaleString('es-AR')}</footer>
</body>
</html>`
}

const RANGES = [
  { label: '6h',  hours: 6  },
  { label: '24h', hours: 24 },
  { label: '3d',  hours: 72 },
  { label: '7d',  hours: 168 },
]

/* ── Componente principal ── */
export default function AnalyticsPanel({ readings, availableNodes }) {
  const [globalStats, setGlobalStats] = useState(null)
  const [rangeIdx,    setRangeIdx]    = useState(1)  // default: 24h

  useEffect(() => {
    fetch(`${BACKEND}/readings/stats`)
      .then(r => r.json())
      .then(setGlobalStats)
      .catch(() => {})
  }, [])

  const range = RANGES[rangeIdx]

  const visibleData = useMemo(() => {
    const cutoff = Date.now() - range.hours * 60 * 60 * 1000
    return readings.filter(d => d.epoch >= cutoff)
  }, [readings, range.hours])

  const nodes = availableNodes.length > 0 ? availableNodes : ['interior']

  function handleCSV() {
    const csv = toCSV(visibleData, nodes)
    const fecha = new Date().toISOString().slice(0, 10)
    downloadFile(csv, `xlimax-${fecha}-${range.label}.csv`, 'text/csv;charset=utf-8;')
  }

  function handleHTML() {
    const html = toHTML(visibleData, nodes, range.label, globalStats)
    const fecha = new Date().toISOString().slice(0, 10)
    downloadFile(html, `xlimax-${fecha}-${range.label}.html`, 'text/html')
  }

  return (
    <div className="space-y-6">

      {/* Conteo global desde Firestore */}
      {globalStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total histórico', value: globalStats.total, icon: Database, color: 'text-violet-500', bg: 'bg-violet-50' },
            { label: 'Desde ayer', value: globalStats.desde_ayer, icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: `En rango ${range.label}`, value: null, icon: Database, color: 'text-cyan-600', bg: 'bg-cyan-50' },
          ].map((item, i) => (
            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${item.bg}`}>
                <item.icon size={20} className={item.color} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {(item.value ?? visibleData.length).toLocaleString('es-AR')}
                </p>
                <p className="text-xs text-slate-400">registros</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selector de rango propio */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Período:</span>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {RANGES.map((r, idx) => (
            <button key={r.label} onClick={() => setRangeIdx(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                rangeIdx === idx ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header con conteo y botones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <p className="text-sm text-slate-500">Registros desde ayer</p>
          <p className="text-3xl font-bold text-slate-900">
            {globalStats ? globalStats.desde_ayer.toLocaleString('es-AR') : '…'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            En vista actual ({range.label}): <strong className="text-slate-600">{visibleData.length.toLocaleString()}</strong> registros
            {visibleData.length > 0 && ` · ${new Date(visibleData[0].epoch).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })} → ${new Date(visibleData[visibleData.length - 1].epoch).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}`}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCSV}
            disabled={visibleData.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Table size={16} /> Exportar CSV
          </button>
          <button
            onClick={handleHTML}
            disabled={visibleData.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <FileText size={16} /> Exportar HTML
          </button>
        </div>
      </div>

      {/* Tabla de estadísticas por nodo */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
        <h3 className="font-bold text-slate-800 mb-4">Estadísticas del período</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 pr-4 text-slate-500 font-semibold w-28">Sensor</th>
              {nodes.flatMap(node => [
                <th key={`${node}-min`} className="text-right py-2 px-3 text-slate-500 font-semibold capitalize" colSpan={4}>{node}</th>
              ])}
            </tr>
            <tr className="border-b border-slate-100">
              <th className="text-left py-1.5 pr-4 text-xs text-slate-400">—</th>
              {nodes.flatMap(node =>
                ['Mín', 'Máx', 'Prom', 'Std'].map(label => (
                  <th key={`${node}-${label}`} className="text-right py-1.5 px-3 text-xs text-slate-400 font-medium">{label}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {SENSORS.map(key => {
              const cfg = SENSOR_CONFIG[key]
              return (
                <tr key={key} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-slate-700">{cfg.label}</span>
                    <span className="text-slate-400 text-xs ml-1">{cfg.unit}</span>
                  </td>
                  {nodes.flatMap(node => {
                    const vals = visibleData
                      .map(d => d.nodes?.[node]?.[key])
                      .filter(v => v != null)
                    if (!vals.length) {
                      return [<td key={`${node}-nodata`} colSpan={4} className="text-center text-slate-300 text-xs py-2.5 px-3">Sin datos</td>]
                    }
                    const min = Math.min(...vals).toFixed(2)
                    const max = Math.max(...vals).toFixed(2)
                    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
                    const std = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length).toFixed(2)
                    return [min, max, avg, std].map((v, i) => (
                      <td key={`${node}-${i}`} className="text-right py-2.5 px-3 font-mono text-slate-700">
                        <span style={{ color: i === 0 ? cfg.colorHex : i === 1 ? cfg.colorHex : 'inherit', fontWeight: i < 2 ? 600 : 400 }}>
                          {v}
                        </span>
                      </td>
                    ))
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Preview de datos */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">
          Últimas lecturas
          <span className="text-xs text-slate-400 font-normal ml-2">(preview — el CSV tiene todos los registros)</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 text-slate-500">Timestamp ART</th>
                {nodes.flatMap(node =>
                  ['T°C', 'H%', 'Luz', 'Pres.', 'Alt.'].map(label => (
                    <th key={`${node}-${label}`} className="text-right py-2 px-2 text-slate-500">
                      <span className="text-slate-300">{node}/</span>{label}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {[...visibleData].reverse().slice(0, 30).map((d, i) => {
                const art = new Date(d.epoch - 3 * 60 * 60 * 1000)
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-1.5 pr-4 text-slate-500 font-mono whitespace-nowrap">
                      {art.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    {nodes.flatMap(node => {
                      const s = d.nodes?.[node] ?? {}
                      return [s.t, s.h, s.l, s.p, s.a].map((v, j) => (
                        <td key={`${node}-${j}`} className="text-right py-1.5 px-2 font-mono text-slate-700">
                          {v != null ? v : <span className="text-slate-200">—</span>}
                        </td>
                      ))
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
