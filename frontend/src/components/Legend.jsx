import { useState, useRef, useEffect } from 'react'
import './Legend.css'

const LEGEND_ITEMS = [
  { color: '#1a9850', label: '< 5mph below historical average' },
  { color: '#91cf60', label: '5-10mph below historical average' },
  { color: '#fee090', label: '10-15mph below historical average' },
  { color: '#fc8d59', label: '15-20mph below historical average' },
  { color: '#d73027', label: '> 20mph below historical average' },
  { color: '#000000', label: 'Closure (No data)' },
]

function Legend() {
  const [collapsed, setCollapsed] = useState(false)
  const [position, setPosition] = useState({ x: 12, y: 12 })
  const legendRef = useRef()
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !legendRef.current) return
      const parent = legendRef.current.offsetParent
      const parentRect = parent.getBoundingClientRect()
      const { offsetWidth: lw, offsetHeight: lh } = legendRef.current
      const rawX = e.clientX - parentRect.left - dragOffset.current.x
      const rawY = e.clientY - parentRect.top - dragOffset.current.y
      setPosition({
        x: Math.min(Math.max(0, rawX), parentRect.width - lw),
        y: Math.min(Math.max(0, rawY), parentRect.height - lh),
      })
    }
    const onMouseUp = () => { dragging.current = false }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const handleMouseDown = (e) => {
    const rect = legendRef.current.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    dragging.current = true
    e.preventDefault()
  }

  return (
    <div
      ref={legendRef}
      className="legend"
      style={{ left: position.x, top: position.y }}
    >
      <div className="legend-header" onMouseDown={handleMouseDown}>
        <span className="legend-title">Speed vs. Historical</span>
        <button
          className="legend-toggle"
          onClick={() => setCollapsed(c => !c)}
          onMouseDown={e => e.stopPropagation()}
        >
          {collapsed ? '▾' : '▴'}
        </button>
      </div>
      {!collapsed && (
        <div className="legend-items">
          {LEGEND_ITEMS.map(({ color, label }) => (
            <div key={color} className="legend-item">
              <span className="legend-swatch" style={{ backgroundColor: color }} />
              <span className="legend-label">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Legend