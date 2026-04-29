import './TimeSlider.css'

function TimeSlider({ currentDateTime, startDate, endDate, onChange }) {
  const totalHours = Math.floor((endDate - startDate) / (1000 * 60 * 60))
  const currentHour = Math.floor((currentDateTime - startDate) / (1000 * 60 * 60))

  const handleChange = (e) => {
    const hours = parseInt(e.target.value)
    const newDate = new Date(startDate.getTime() + hours * 60 * 60 * 1000)
    onChange(newDate)
  }

  const step = (delta) => {
    const newHour = Math.min(totalHours, Math.max(0, currentHour + delta))
    const newDate = new Date(startDate.getTime() + newHour * 60 * 60 * 1000)
    onChange(newDate)
  }

  const formatDateTime = (date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="time-slider-bar">
      <div className="time-slider-label">{formatDateTime(currentDateTime)}</div>
      <div className="time-slider-controls">
        <button className="time-slider-arrow" onClick={() => step(-1)} disabled={currentHour === 0}>&#8249;</button>
        <input
          type="range"
          min={0}
          max={totalHours}
          value={currentHour}
          onChange={handleChange}
          className="time-slider-input"
        />
        <button className="time-slider-arrow" onClick={() => step(1)} disabled={currentHour === totalHours}>&#8250;</button>
      </div>
      <div className="time-slider-bounds">
        <span>{formatDateTime(startDate)}</span>
        <span>–</span>
        <span>{formatDateTime(endDate)}</span>
      </div>
    </div>
  )
}

export default TimeSlider