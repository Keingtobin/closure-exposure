import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import TimeSlider from './components/TimeSlider'
import Legend from './components/Legend'
import WeatherDisplay from './components/WeatherDisplay'

import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css'

const SLIDER_START = new Date(2019, 1, 1, 0, 0, 0)   // Feb 1 2019
const SLIDER_END = new Date(2019, 2, 31, 23, 0, 0)   // Mar 31 2019

const INITIAL_CENTER = [
  -106.0928,
  39.5896
]
const INITIAL_ZOOM = 9.1

const MAP_EXTENT = [
  [-107.16070093363171, 39.13691469408802],
  [-104.82680521947686, 40.19452570772954]
]

const formatKey = (date) => {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${date.getHours()}:00`
}

function App() {
  const mapRef = useRef()
  const mapContainerRef = useRef()
  const speedLookupRef = useRef(null)      // { tmc_code: { "M/D/YYYY H:00": speed_norm } }
  const tmcToIdRef = useRef(null)          // { tmc_code: feature_id }
  const currentDateTimeRef = useRef(SLIDER_START)

  const [currentDateTime, setCurrentDateTime] = useState(SLIDER_START)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [selectedStation, setSelectedStation] = useState(null)

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      style: 'mapbox://styles/mapbox/streets-v11',
      pitchWithRotate: false,
      dragRotate: false,
      touchZoomRotate: false,
      maxBounds: MAP_EXTENT
    });

    mapRef.current.on('load', async () => {
      // Fetch GeoJSON and build tmc -> feature id map
      const geoRes = await fetch('/shapes/tmc-segments.geojson')
      const weatherRes = await fetch('/shapes/weather_stations.json')
      const geoData = await geoRes.json()
      const weatherShapes = await weatherRes.json()

      const tmcToId = {}
      geoData.features.forEach(f => {
        tmcToId[f.properties.tmc] = f.id
      })
      tmcToIdRef.current = tmcToId

      mapRef.current.addSource('tmc-segments', {
        type: 'geojson',
        data: geoData
      })

      mapRef.current.addSource('weather-stations', {
        type: 'geojson',
        data: weatherShapes
      })

      mapRef.current.addLayer({
        id: 'tmc-segments-layer',
        type: 'line',
        source: 'tmc-segments',
        paint: {
          'line-color': [
            'interpolate', ['linear'],
            ['coalesce', ['feature-state', 'speed'], 999],
            5,  '#1a9850',
            10,   '#91cf60',
            15,    '#fee090',
            20,    '#fc8d59',
            25,   '#d73027',
            999,  '#000000'
          ],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            8,  2,
            10, 3,
            12, 4,
            14, 7,
            16, 12
          ],
        }
      })

      await new Promise((resolve, reject) => {
        mapRef.current.loadImage('/snotel_marker_48px.png', (err, img) => {
          if (err) return reject(err)
          mapRef.current.addImage('weather-station-icon', img)
          resolve()
        })
      })

      mapRef.current.addLayer({
        id: 'weather-stations-layer',
        type: 'symbol',
        source: 'weather-stations',
        layout: {
          'icon-image': 'weather-station-icon',
          'icon-size': 0.5,
          'icon-allow-overlap': true,
        }
      })

      mapRef.current.on('mouseenter', 'weather-stations-layer', () => {
        mapRef.current.getCanvas().style.cursor = 'pointer'
      })
      mapRef.current.on('mouseleave', 'weather-stations-layer', () => {
        mapRef.current.getCanvas().style.cursor = ''
      })

      mapRef.current.addInteraction('weather-station-click', {
        type: 'click',
        target: { layerId: 'weather-stations-layer' },
        handler: (e) => {
          setSelectedStation(e.feature.properties.Site_ID)
        }
      })

      // Fetch and parse speed CSV
      const csvRes = await fetch('/speed/hrly2019.csv')
      const csvText = await csvRes.text()
      const lines = csvText.trim().split(/\r?\n/)

      const lookup = {}
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',')
        const tmc_code = cols[0]
        const measurement_tstamp = cols[1]
        const speed_norm = cols[7]
        if (!lookup[tmc_code]) lookup[tmc_code] = {}
        lookup[tmc_code][measurement_tstamp] = speed_norm === '' ? null : parseFloat(speed_norm)
      }
      speedLookupRef.current = lookup
      setDataLoaded(true)
    })

    return () => {
      mapRef.current.remove()
    }
  }, [])

  // Update feature states whenever the selected time changes
  useEffect(() => {
    currentDateTimeRef.current = currentDateTime
    if (!dataLoaded || !mapRef.current || !speedLookupRef.current || !tmcToIdRef.current) return

    const key = formatKey(currentDateTime)
    Object.entries(tmcToIdRef.current).forEach(([tmc, id]) => {
      const speed = speedLookupRef.current[tmc]?.[key] ?? null
      mapRef.current.setFeatureState(
        { source: 'tmc-segments', id },
        { speed }
      )
    })
  }, [currentDateTime, dataLoaded])

  return (
    <>
      <div className="sidebar">
        {selectedStation ? (
          <WeatherDisplay stationId={selectedStation} currentDate={currentDateTime} />
        ) : <p className="sidebar-placeholder">Click on a weather station to display weather data.</p>}
        <div className="sidebar-logos" style={{ marginTop: 'auto' }}>
          <a href="https://www.walkerofalltrades.com/" target="_blank" rel="noreferrer">
            <img src="/WOAT-png-transparent.png" alt="WOAT" className="sidebar-logo" />
          </a>
          <a href="https://www.colorado.edu/geography/undergrad-program/internships-0" target="_blank" rel="noreferrer">
            <img src="/CU-Boulder-Symbol.png" alt="CU Boulder" className="sidebar-logo" />
          </a>
        </div>
      </div>
      <div className="map-column">
        <div className="map-wrapper">
          <div id='map-container' ref={mapContainerRef} />
          <Legend />
        </div>
        <TimeSlider
          currentDateTime={currentDateTime}
          startDate={SLIDER_START}
          endDate={SLIDER_END}
          onChange={setCurrentDateTime}
        />
      </div>
    </>
  )
}

export default App