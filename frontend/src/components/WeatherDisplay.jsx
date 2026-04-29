import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import './WeatherDisplay.css'

const STATION_FILES = {
  602:  { file: 'loveland_data.csv',     name: 'Loveland' },
  415:  { file: 'copper_data.csv',       name: 'Copper Mountain' },
  842:  { file: 'vail_data.csv',         name: 'Vail Pass' },
  1040: { file: 'eagle_data.csv',        name: 'Eagle' },
  802:  { file: 'silverthorne_data.csv', name: 'Silverthorne' },
  936:  { file: 'georgetown_data.csv',   name: 'Georgetown' },
}

function parseCSVLine(line) {
  const cols = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') inQ = !inQ
    else if (ch === ',' && !inQ) { cols.push(cur); cur = '' }
    else cur += ch
  }
  cols.push(cur)
  return cols
}

function parseDate(dateStr) {
  if (dateStr.includes('-')) {
    const [y, mo, d] = dateStr.split('-').map(Number)
    return [y, mo, d]
  }
  const [mo, d, y] = dateStr.split('/').map(Number)
  return [y, mo, d]
}

function parseStationCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    const [y, mo, d] = parseDate(cols[3])
    const [h, m] = cols[4].split(':').map(Number)
    const dt = new Date(y, mo - 1, d, h, m, 0)
    const temp = cols[5] === '' ? null : parseFloat(cols[5])
    const rawSnwd = parseFloat(cols[6])
    const snwd = cols[6] === '' || rawSnwd === 99.9 || rawSnwd < 0 ? null : rawSnwd
    const diff = cols[9] === '' || cols[9] === undefined ? null : parseFloat(cols[9])
    rows.push({ dt, temp, snwd, diff })
  }
  return rows.sort((a, b) => a.dt - b.dt)
}

const TICK_STEP = 2
const fmtTime = ts => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })

function SnowDepthChart({ windowData, yDomain }) {
  if (!windowData.length) return <p className="wd-no-data">No data in this window</p>

  const chartData = windowData.map(r => ({ timestamp: r.dt.getTime(), snwd: r.snwd }))
  const minT = chartData[0].timestamp
  const maxT = chartData[chartData.length - 1].timestamp

  const [yMin, yMax] = yDomain
  const yRange = yMax - yMin
  const yStep = yRange <= 10 ? 1 : yRange <= 20 ? 2 : yRange <= 50 ? 5 : 10
  const yTicks = []
  for (let t = Math.ceil(yMin / yStep) * yStep; t <= yMax; t += yStep) yTicks.push(t)

  // Pick every TICK_STEP-th data point as a tick — always clean local hours, no timezone math
  const ticks = chartData
    .filter((_, i) => i % TICK_STEP === 0)
    .map(d => d.timestamp)
  if (ticks[ticks.length - 1] !== maxT) ticks.push(maxT)

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="timestamp"
          type="number"
          scale="time"
          domain={[minT, maxT]}
          ticks={ticks}
          tickFormatter={fmtTime}
          tick={{ fontSize: 10, fill: '#64748b' }}
        />
        <YAxis
          domain={yDomain}
          ticks={yTicks}
          tick={{ fontSize: 10, fill: '#64748b' }}
          tickFormatter={v => `${v}"`}
          width={40}
        />
        <Tooltip
          labelFormatter={fmtTime}
          formatter={v => v !== null ? [`${v}"`, 'Snow Depth'] : ['No data', 'Snow Depth']}
          contentStyle={{ fontSize: 12, fontFamily: 'monospace' }}
        />
        <Line
          type="monotone"
          dataKey="snwd"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

const toF = c => ((c * 9) / 5 + 32).toFixed(1)

function WeatherDisplay({ stationId, currentDate }) {
  const [allRows, setAllRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const station = STATION_FILES[stationId]
    if (!station) return
    setLoading(true)
    setAllRows([])
    fetch(`/weather/${station.file}`)
      .then(r => r.text())
      .then(text => {
        setAllRows(parseStationCSV(text))
        setLoading(false)
      })
  }, [stationId])

  const { windowData, currentTemp, currentSnwd, currentDiff, yDomain } = useMemo(() => {
    if (!allRows.length) return { windowData: [], currentTemp: null, currentSnwd: null, currentDiff: null, yDomain: [0, 'auto'] }

    const endMs = currentDate.getTime()
    const startMs = endMs - 12 * 60 * 60 * 1000
    const windowData = allRows.filter(r => {
      const t = r.dt.getTime()
      return t >= startMs && t <= endMs
    })

    const windowSnwd = windowData.map(r => r.snwd).filter(v => v !== null)
    const windowMin = windowSnwd.length ? Math.min(...windowSnwd) : 0
    const windowMax = windowSnwd.length ? Math.max(...windowSnwd) : 10
    const buffer = Math.max(1, Math.round((windowMax - windowMin) * 0.1))
    const yDomain = [Math.floor(windowMin - buffer), Math.ceil(windowMax + buffer)]

    const currentRow = allRows.find(r => r.dt.getTime() === endMs)
    return {
      windowData,
      currentTemp: currentRow?.temp ?? null,
      currentSnwd: currentRow?.snwd ?? null,
      currentDiff: currentRow?.diff ?? null,
      yDomain,
    }
  }, [allRows, currentDate])

  const stationName = STATION_FILES[stationId]?.name ?? `Station ${stationId}`

  const dateLabel = currentDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <div className="weather-display">
      <div className="wd-header">
        <span className="wd-station-name">{stationName}</span>
      </div>
      <div className="wd-temp-row">
        <span className="wd-temp-label">Temperature</span>
        <div className="wd-temp-right">
          {loading || currentTemp === null
            ? <span className="wd-temp-value">No data</span>
            : <>
                <span className="wd-temp-value">{currentTemp}°C</span>
                <span className="wd-temp-divider">/</span>
                <span className="wd-temp-value">{toF(currentTemp)}°F</span>
              </>
          }
        </div>
      </div>
      <div className="wd-temp-row">
        <span className="wd-temp-label">Snow Depth</span>
        <div className="wd-temp-right">
          <span className="wd-temp-value">
            {loading || currentSnwd === null ? 'No data' : `${currentSnwd}"`}
          </span>
          <span className="wd-temp-divider">|</span>
          <span className="wd-snow-diff">
            {loading || currentDiff === null ? 'NODATA' : `${currentDiff > 0 ? '+' : ''}${currentDiff}"`}
          </span>
        </div>
      </div>
      <div className="wd-chart-section">
        <div className="wd-chart-label">Snow Depth — Last 12 Hours</div>
        <div className="wd-chart-date">{dateLabel}</div>
        {loading
          ? <p className="wd-loading">Loading...</p>
          : <SnowDepthChart windowData={windowData} yDomain={yDomain} />
        }
      </div>
    </div>
  )
}

export default WeatherDisplay