import { LayoutDashboard, Thermometer, Droplets, Sun, Wind, Mountain, Zap, Star, BarChart2 } from 'lucide-react'

const NAV = [
  { id: 'overview',    label: 'Inicio',   Icon: LayoutDashboard },
  { id: 't',           label: 'Temp',     Icon: Thermometer,  dot: '#ef4444' },
  { id: 'h',           label: 'Hum',      Icon: Droplets,     dot: '#06b6d4' },
  { id: 'l',           label: 'Luz',      Icon: Sun,          dot: '#84cc16' },
  { id: 'p',           label: 'Pres',     Icon: Wind,         dot: '#8b5cf6' },
  { id: 'a',           label: 'Alt',      Icon: Mountain,     dot: '#ec4899' },
  { id: 'control',     label: 'Control',  Icon: Zap },
  { id: 'analytics',   label: 'Análisis', Icon: BarChart2 },
]

export default function BottomNav({ activeView, onNavigate }) {
  return (
    <nav className="bottom-nav">
      {NAV.map(({ id, label, Icon, dot }) => {
        const active = activeView === id
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative
              ${active ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            {dot && active && (
              <span className="absolute top-2 right-1/4 w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
            )}
            <Icon size={20} />
            <span className="text-[9px] font-semibold">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
