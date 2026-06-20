import { useState, useMemo, useEffect } from 'react'
import { SENSOR_CONFIG } from './data/mockData'
import { useReadings } from './hooks/useReadings'
import Sidebar from './components/Sidebar'
import SensorCard from './components/SensorCard'
import ChartPanel from './components/ChartPanel'
import StatsPanel from './components/StatsPanel'
import ControlPanel from './components/ControlPanel'
import AutomationPanel from './components/AutomationPanel'
import AnalyticsPanel from './components/AnalyticsPanel'
import VpdPanel from './components/VpdPanel'
import HistoryPanel from './components/HistoryPanel'
import BottomNav from './components/BottomNav'

const RANGES = [
  { label: '1h',  hours: 1  },
  { label: '6h',  hours: 6  },
  { label: '24h', hours: 24 },
  { label: '3d',  hours: 72 },
]

export default function App() {
  const [view,          setView]          = useState('overview')
  const [rangeIdx,      setRangeIdx]      = useState(2)
  const [focusSensor,   setFocusSensor]   = useState('t')
  const [selectedNode,  setSelectedNode]  = useState(null)

  const { data: readings, live } = useReadings()

  // Nodos disponibles según el último dato real de Firestore
  const availableNodes = useMemo(() => {
    const last = [...readings].reverse().find(d => d.nodes && Object.keys(d.nodes).length > 0)
    return last ? Object.keys(last.nodes) : []
  }, [readings])

  // Auto-selecciona el primer nodo cuando llegan datos
  useEffect(() => {
    if (availableNodes.length > 0 && !selectedNode) {
      setSelectedNode(availableNodes[0])
    }
  }, [availableNodes, selectedNode])

  // Proyecta los readings al nodo seleccionado
  const nodeReadings = useMemo(() => {
    if (!selectedNode) return readings
    return readings.map(d => {
      const node = d.nodes?.[selectedNode]
      if (!node) return { epoch: d.epoch, t: null, h: null, l: null, p: null, a: null }
      return { epoch: d.epoch, ...node }
    })
  }, [readings, selectedNode])

  const range       = RANGES[rangeIdx]
  const visibleData = useMemo(() => {
    const cutoff = Date.now() - range.hours * 60 * 60 * 1000
    return nodeReadings.filter(d => d.epoch >= cutoff)
  }, [nodeReadings, range.hours])
  const lastReading = nodeReadings[nodeReadings.length - 1]

  const sensorView    = view === 't' || view === 'h' || view === 'l' || view === 'p' || view === 'a'
  const currentSensor = sensorView ? view : focusSensor

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">

      <Sidebar activeView={view} onNavigate={setView} live={live} lastReading={lastReading} />

      <main className="flex-1 overflow-y-auto main-content">

        {view === 'overview' && (
          <div className="p-5 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <PageHeader title="Dashboard" subtitle="Monitoreo ambiental en tiempo real" />
              <NodeSelector nodes={availableNodes} selected={selectedNode} onSelect={setSelectedNode} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.keys(SENSOR_CONFIG).map(k => (
                <SensorCard key={k} sensorKey={k} data={nodeReadings} rangeHours={range.hours}
                  active={k === focusSensor} onClick={() => setFocusSensor(k)} />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ChartPanel data={visibleData} sensorKey="combined"
                  rangeIdx={rangeIdx} onRangeChange={setRangeIdx} />
              </div>
              <div className="space-y-5">
                <ControlPanel lastReading={lastReading} compact />
                <AutomationPanel lastReading={lastReading} compact />
              </div>
            </div>
          </div>
        )}

        {sensorView && (
          <div className="p-5 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <PageHeader title={SENSOR_CONFIG[view].label} subtitle="Detalle y estadísticas del período" />
              <NodeSelector nodes={availableNodes} selected={selectedNode} onSelect={setSelectedNode} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SensorCard sensorKey={view} data={nodeReadings} rangeHours={range.hours} active onClick={() => {}} />
            </div>
            <ChartPanel data={visibleData} sensorKey={view} rangeIdx={rangeIdx} onRangeChange={setRangeIdx} />
            <StatsPanel data={visibleData} sensorKey={view} showDays />
          </div>
        )}

        {view === 'vpd' && (
          <div className="p-5 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <PageHeader title="VPD" subtitle="Déficit de presión de vapor — foliar y de aire" />
              <NodeSelector nodes={availableNodes} selected={selectedNode} onSelect={setSelectedNode} />
            </div>
            <VpdPanel data={visibleData} rangeIdx={rangeIdx} onRangeChange={setRangeIdx} />
          </div>
        )}

        {view === 'analytics' && (
          <div className="p-5 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <PageHeader title="Análisis y Exportación" subtitle="Estadísticas del período y descarga de datos" />
              <NodeSelector nodes={availableNodes} selected={selectedNode} onSelect={setSelectedNode} />
            </div>
            <AnalyticsPanel
              readings={readings}
              availableNodes={availableNodes}
            />
          </div>
        )}

        {view === 'historico' && (
          <div className="p-5 md:p-8 space-y-6">
            <PageHeader title="Históricos" subtitle="Datos agregados de todo el período almacenado" />
            <HistoryPanel availableNodes={availableNodes} />
          </div>
        )}

        {view === 'control' && (
          <div className="p-5 md:p-8 space-y-6">
            <PageHeader title="Actuadores" subtitle="Control manual de dispositivos" />
            <ControlPanel lastReading={lastReading} />
          </div>
        )}

        {view === 'automation' && (
          <div className="p-5 md:p-8 space-y-6">
            <PageHeader title="Automatización" subtitle="Reglas y log de actividad" />
            <AutomationPanel lastReading={lastReading} />
          </div>
        )}
      </main>

      <BottomNav activeView={view} onNavigate={setView} />
    </div>
  )
}

function PageHeader({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>
    </div>
  )
}

function NodeSelector({ nodes, selected, onSelect }) {
  if (nodes.length <= 1) return null
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Sector:</span>
      <div className="flex gap-1.5">
        {nodes.map(node => (
          <button
            key={node}
            onClick={() => onSelect(node)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
              selected === node
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {node}
          </button>
        ))}
      </div>
    </div>
  )
}
