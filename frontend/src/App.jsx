import { useState, useMemo } from 'react'
import { SENSOR_CONFIG } from './data/mockData'
import { useReadings } from './hooks/useReadings'
import Sidebar from './components/Sidebar'
import SensorCard from './components/SensorCard'
import ChartPanel from './components/ChartPanel'
import StatsPanel from './components/StatsPanel'
import ControlPanel from './components/ControlPanel'
import AutomationPanel from './components/AutomationPanel'
import BottomNav from './components/BottomNav'

const RANGES = [
  { label: '1h',  points: 12  },
  { label: '6h',  points: 72  },
  { label: '24h', points: 288 },
  { label: '3d',  points: 864 },
]

export default function App() {
  const [view,        setView]        = useState('overview')
  const [rangeIdx,    setRangeIdx]    = useState(2)
  const [focusSensor, setFocusSensor] = useState('t')

  const { data: readings, live } = useReadings()
  const range       = RANGES[rangeIdx]
  const visibleData = useMemo(() => readings.slice(-range.points), [readings, range.points])
  const lastReading = readings[readings.length - 1]

  const sensorView    = view === 't' || view === 'h' || view === 'l'
  const currentSensor = sensorView ? view : focusSensor

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">

      <Sidebar activeView={view} onNavigate={setView} live={live} lastReading={lastReading} />

      <main className="flex-1 overflow-y-auto main-content">

        {view === 'overview' && (
          <div className="p-5 md:p-8 space-y-6">
            <PageHeader title="Dashboard" subtitle="Monitoreo ambiental en tiempo real" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.keys(SENSOR_CONFIG).map(k => (
                <SensorCard key={k} sensorKey={k} data={readings} rangePoints={range.points}
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
            <PageHeader title={SENSOR_CONFIG[view].label} subtitle="Detalle y estadísticas del período" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SensorCard sensorKey={view} data={readings} rangePoints={range.points} active onClick={() => {}} />
            </div>
            <ChartPanel data={visibleData} sensorKey={view} rangeIdx={rangeIdx} onRangeChange={setRangeIdx} />
            <StatsPanel data={visibleData} sensorKey={view} showDays />
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
