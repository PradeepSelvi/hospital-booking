import { useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────
// HospitalsMap — multi-pin map of hospitals (MediBook + external OSM).
// Leaflet is loaded via CDN in index.html (global window.L).
// ─────────────────────────────────────────────

const DEFAULT_CENTER = [20.5937, 78.9629] // India
const DEFAULT_ZOOM = 5

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

/**
 * @param {Object} props
 * @param {Array} props.hospitals - places with numeric latitude/longitude + placeKey + external flag
 * @param {{lat:number,lng:number}|null} props.userLocation - optional "you are here"
 * @param {string|null} props.focusKey - placeKey to fly to / open popup
 * @param {(place:object)=>void} props.onSelect - marker click callback
 * @param {string} props.height
 */
export default function HospitalsMap({
  hospitals = [],
  userLocation = null,
  focusKey = null,
  onSelect,
  routeLine = null,
  fitSignal = null,
  height = '440px',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map()) // placeKey -> marker
  const clusterRef = useRef(null)      // markerClusterGroup (or null if plugin missing)
  const userMarkerRef = useRef(null)
  const routeLayerRef = useRef(null)
  const fitDoneRef = useRef(null) // last fitSignal we've auto-fit for
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const leafletReady = useCallback(() => typeof window !== 'undefined' && window.L, [])

  // Initialise once.
  useEffect(() => {
    if (!containerRef.current || !leafletReady() || mapRef.current) return
    const L = window.L
    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
      zoomControl: true,
    })

    // ── Base layers (Google-Maps-like map / satellite / hybrid switch) ──
    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    })
    // Esri World Imagery — free satellite tiles, no API key required.
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 19,
      }
    )
    // Reference labels (roads, place names) drawn on top of satellite = "Hybrid".
    const labels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    )
    const hybrid = L.layerGroup([satellite, labels])

    streets.addTo(map) // default base layer

    L.control.layers(
      { Map: streets, Satellite: satellite, Hybrid: hybrid },
      {},
      { position: 'topright', collapsed: true }
    ).addTo(map)

    // Distance scale bar (bottom-left), like Google Maps.
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map)

    // Cluster group so dense pins (e.g. the full directory) group into counts.
    // Falls back to plain markers if the plugin failed to load.
    if (typeof L.markerClusterGroup === 'function') {
      const cluster = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
      })
      map.addLayer(cluster)
      clusterRef.current = cluster
    }

    // ── Custom fullscreen control ──
    const FullscreenControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const btn = L.DomUtil.create('a', 'leaflet-bar leaflet-control leaflet-control-fullscreen')
        btn.href = '#'
        btn.title = 'Toggle fullscreen'
        btn.setAttribute('role', 'button')
        btn.setAttribute('aria-label', 'Toggle fullscreen')
        btn.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>'
        L.DomEvent.on(btn, 'click', L.DomEvent.stop).on(btn, 'click', () => {
          const el = containerRef.current?.closest('.hospital-map-wrapper') || containerRef.current
          if (!document.fullscreenElement) {
            el?.requestFullscreen?.().then(() => setTimeout(() => map.invalidateSize(), 200)).catch(() => {})
          } else {
            document.exitFullscreen?.().then(() => setTimeout(() => map.invalidateSize(), 200)).catch(() => {})
          }
        })
        return btn
      },
    })
    map.addControl(new FullscreenControl())

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = new Map()
      userMarkerRef.current = null
    }
  }, [leafletReady])

  // Build a divIcon for a place (blue = MediBook, teal = external, green = govt).
  const makeIcon = useCallback((place) => {
    const L = window.L
    let cls = 'hospital-marker-pin'
    let icon = 'bi-hospital-fill'
    if (place.dictionary && !place.govt) {
      // Full-directory (private / uncategorised) hospital.
      cls = 'hospital-marker-pin dictionary'
      icon = 'bi-building'
    } else if (place.govt) {
      cls = 'hospital-marker-pin govt'
      icon = 'bi-hospital-fill'
    } else if (place.external) {
      cls = 'hospital-marker-pin external'
      icon = 'bi-geo-alt-fill'
    }
    return L.divIcon({
      className: 'hospital-map-marker',
      html: `<div class="${cls}"><i class="bi ${icon}"></i></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -36],
    })
  }, [])

  // Sync markers whenever the list changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !leafletReady()) return
    const L = window.L

    const cluster = clusterRef.current
    if (cluster) cluster.clearLayers()
    else markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = new Map()

    const points = []
    hospitals.forEach(h => {
      if (h.latitude == null || h.longitude == null) return
      if (Number.isNaN(h.latitude) || Number.isNaN(h.longitude)) return

      const marker = L.marker([h.latitude, h.longitude], { icon: makeIcon(h) })
      if (cluster) cluster.addLayer(marker)
      else marker.addTo(map)
      const ratingLine = (h.govt || h.dictionary)
        ? (h.care_type ? `<div style="font-size:12px;color:#059669;margin-top:2px;">${escapeHtml(h.care_type)}</div>` : '')
        : h.review_count > 0
          ? `<div style="font-size:12px;color:#F59E0B;margin-top:2px;">★ ${Number(h.avg_rating).toFixed(1)} <span style="color:#888;">(${h.review_count})</span></div>`
          : `<div style="font-size:12px;color:#999;margin-top:2px;">No reviews yet</div>`
      const badge = h.govt
        ? `<span style="font-size:10px;font-weight:700;color:#059669;background:rgba(5,150,105,.1);padding:1px 6px;border-radius:8px;">Govt Hospital</span>`
        : h.dictionary
          ? `<span style="font-size:10px;font-weight:700;color:#B45309;background:rgba(217,119,6,.12);padding:1px 6px;border-radius:8px;">Directory</span>`
        : h.external
          ? `<span style="font-size:10px;font-weight:700;color:#0E7490;background:rgba(14,116,144,.1);padding:1px 6px;border-radius:8px;">Not on MediBook</span>`
          : `<span style="font-size:10px;font-weight:700;color:#0077B6;background:rgba(0,119,182,.1);padding:1px 6px;border-radius:8px;">MediBook</span>`
      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif;min-width:170px;">
          <strong style="font-size:14px;color:#1a1a2e;">${escapeHtml(h.name)}</strong>
          <div style="font-size:12px;color:#666;">${escapeHtml([h.city, h.state].filter(Boolean).join(', '))}</div>
          ${ratingLine}
          <div style="margin-top:6px;">${badge}</div>
        </div>
      `)
      marker.on('click', () => onSelectRef.current?.(h))
      markersRef.current.set(h.placeKey, marker)
      points.push([h.latitude, h.longitude])
    })

    // Auto-fit only once per new search (fitSignal change) and never while a
    // route is displayed — otherwise late-resolving markers (e.g. async pincode
    // geocodes) would keep yanking the viewport around or clobber the route.
    if (routeLine) return
    if (fitSignal != null && fitDoneRef.current === fitSignal) return

    if (userLocation) points.push([userLocation.lat, userLocation.lng])
    if (points.length === 1) {
      map.setView(points[0], 13)
      if (fitSignal != null) fitDoneRef.current = fitSignal
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
      if (fitSignal != null) fitDoneRef.current = fitSignal
    }
  }, [hospitals, leafletReady, makeIcon, fitSignal, routeLine, userLocation])

  // "You are here" marker.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !leafletReady()) return
    const L = window.L

    if (!userLocation) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current)
        userMarkerRef.current = null
      }
      return
    }

    const userIcon = L.divIcon({
      className: 'hospital-map-marker',
      html: `<div class="user-location-pin"><span></span></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    })
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng])
    } else {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<strong>You are here</strong>')
    }
    map.setView([userLocation.lat, userLocation.lng], 12, { animate: true })
  }, [userLocation, leafletReady])

  // Fly to a focused place and open its popup.
  useEffect(() => {
    const map = mapRef.current
    if (!map || focusKey == null) return
    const marker = markersRef.current.get(focusKey)
    if (marker) {
      const cluster = clusterRef.current
      if (cluster && typeof cluster.zoomToShowLayer === 'function') {
        // Un-cluster the marker first so its popup is actually visible.
        cluster.zoomToShowLayer(marker, () => marker.openPopup())
        map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.6 })
      } else {
        map.flyTo(marker.getLatLng(), 15, { duration: 0.6 })
        marker.openPopup()
      }
    }
  }, [focusKey])

  // Draw / clear a directions route line and fit the map to it.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !leafletReady()) return
    const L = window.L

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current)
      routeLayerRef.current = null
    }
    if (Array.isArray(routeLine) && routeLine.length >= 2) {
      const line = L.polyline(routeLine, {
        color: '#059669',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
      }).addTo(map)
      routeLayerRef.current = line
      map.fitBounds(line.getBounds(), { padding: [50, 50], maxZoom: 15 })
    }
  }, [routeLine, leafletReady])

  if (!leafletReady()) {
    return (
      <div className="hospital-map-fallback" style={{ height }}>
        <i className="bi bi-geo-alt" style={{ fontSize: 32, color: 'var(--gray-300)' }} />
        <p style={{ fontSize: 13, color: 'var(--gray-400)', margin: '8px 0 0' }}>Map loading…</p>
      </div>
    )
  }

  return (
    <div className="hospital-map-wrapper">
      <div ref={containerRef} className="hospital-map-container" style={{ height, borderRadius: 12 }} />
    </div>
  )
}
