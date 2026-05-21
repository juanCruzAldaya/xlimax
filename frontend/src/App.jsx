import { useState, useMemo } from 'react'
import { SENSOR_CONFIG } from './data/mockData'
import { useReadings } from './hooks/useReadings'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import SensorCard from './components/SensorCard'
import ChartPanel from './components/ChartPanel'
import StatsPanel from './components/StatsPanel'
import AutomationPanel from './components/AutomationPanel'

const RANGES = [
  { label: '1h',  points: 12  },
  { label: '6h',  points: 72  },
  { label: '24h', points: 288 },
  { label: '3d',  points: 864 },
]

export default function App() {
  const [view,       setView]       = useState('overview')
  const [rangeIdx,   setRangeIdx]   = useState(2)
  const [focusSensor, setFocusSensor] = useState('t')

  const { data: readings, live } = useReadings()

  const range       = RANGES[rangeIdx]
  const visibleData = useMemo(() => readings.slice(-range.points), [readings, range.points])
  const lastReading = readings[readings.length - 1]

  const sensorView = view === 't' || view === 'h' || view === 'l'
  const currentSensor = sensorView ? view : focusSensor

  function goSensor(k) {
    setFocusSensor(k)
    setView(k)
  }

  return (
    <div className="app">
      <Header lastReading={lastReading} live={live} />

      <div className="app-body">
        <Sidebar activeView={view} onNavigate={setView} />

        <main className="app-main">

          {/* OVERVIEW */}
          {view === 'overview' && (
            <div className="view">
              <div className="view-cards">
                {Object.keys(SENSOR_CONFIG).map(k => (
                  <SensorCard
                    key={k}
                    sensorKey={k}
                    data={readings}
                    rangePoints={range.points}
                    active={k === focusSensor}
                    onClick={() => setFocusSensor(k)}
                  />
                ))}
              </div>

              <ChartPanel
                data={visibleData}
                sensorKey={currentSensor}
                range={range}
                rangeIdx={rangeIdx}
                onRangeChange={setRangeIdx}
                onSensorChange={k => setFocusSensor(k)}
              />

              <StatsPanel data={visibleData} sensorKey={currentSensor} />
            </div>
          )}

          {/* SENSOR DETAIL */}
          {sensorView && (
            <div className="view">
              <div className="view-cards view-cards--single">
                <SensorCard
                  sensorKey={view}
                  data={readings}
                  rangePoints={range.points}
                  active
                  onClick={() => {}}
                />
              </div>

              <ChartPanel
                data={visibleData}
                sensorKey={view}
                range={range}
                rangeIdx={rangeIdx}
                onRangeChange={setRangeIdx}
              />

              <StatsPanel data={visibleData} sensorKey={view} showDays />
            </div>
          )}

          {/* AUTOMATION */}
          {view === 'automation' && (
            <AutomationPanel lastReading={lastReading} />
          )}

        </main>
      </div>
    </div>
  )
}
