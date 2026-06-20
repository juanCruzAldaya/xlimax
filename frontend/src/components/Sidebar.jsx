import { Leaf, LayoutDashboard, Thermometer, Droplets, Gauge, Sun, Wind, Mountain, Zap, Star, BarChart2, History } from 'lucide-react'

const NAV = [
  {
    section: 'Monitoreo',
    items: [
      { id: 'overview', label: 'Dashboard',    icon: LayoutDashboard },
      { id: 't',        label: 'Temperatura',  icon: Thermometer,  dot: '#ef4444' },
      { id: 'h',        label: 'Humedad',      icon: Droplets,     dot: '#06b6d4' },
      { id: 'vpd',      label: 'VPD',          icon: Gauge,        dot: '#14b8a6' },
      { id: 'l',        label: 'Luminosidad',  icon: Sun,          dot: '#84cc16' },
      { id: 'p',        label: 'Presión',      icon: Wind,         dot: '#8b5cf6' },
      { id: 'a',        label: 'Altitud',      icon: Mountain,     dot: '#ec4899' },
    ],
  },
  {
    section: 'Control',
    items: [
      { id: 'control',    label: 'Actuadores',     icon: Zap },
      { id: 'automation', label: 'Automatización', icon: Star },
    ],
  },
  {
    section: 'Datos',
    items: [
      { id: 'historico', label: 'Históricos', icon: History },
      { id: 'analytics', label: 'Análisis',   icon: BarChart2 },
    ],
  },
]

export default function Sidebar({ activeView, onNavigate, live, lastReading }) {
  const timeStr = lastReading
    ? new Date(lastReading.epoch).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <aside className="desktop-sidebar w-64 bg-white border-r border-slate-200 flex flex-col p-4 md:min-h-screen flex-shrink-0">

      {/* Brand */}
      <div className="flex items-center gap-3 mb-8 px-2 mt-2">
        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
          <Leaf size={24} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight tracking-wide">XLIMAX</h1>
          <p className="text-xs text-slate-500">Monitor Ambiental</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5">
        {NAV.map(section => (
          <div key={section.section}>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-3 mb-2">
              {section.section}
            </p>
            <div className="space-y-1">
              {section.items.map(item => {
                const Icon = item.icon
                const active = activeView === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {item.dot && (
                      <span className="w-2 h-2 rounded-full" style={{ background: item.dot }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status badge */}
      <div className={`mt-6 p-4 rounded-2xl border ${live
        ? 'bg-emerald-50 border-emerald-100'
        : 'bg-slate-50 border-slate-200'}`}
      >
        <div className={`flex items-center gap-2 font-medium mb-1 text-sm ${live ? 'text-emerald-800' : 'text-slate-600'}`}>
          <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          {live ? 'Sistema en línea' : 'Datos de demo'}
        </div>
        <p className={`text-xs ${live ? 'text-emerald-600' : 'text-slate-400'}`}>
          {live ? `Última lectura: ${timeStr}` : 'ESP32 desconectado'}
        </p>
      </div>
    </aside>
  )
}
