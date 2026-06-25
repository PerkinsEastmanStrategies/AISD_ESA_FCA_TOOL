"use client"

import { useEffect, useMemo, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { MAPBOX_TOKEN } from "@/lib/dashboard-data"
import { findGeoSchoolLocation } from "@/lib/aisd-schools"

const AERIAL_STYLE = "mapbox://styles/mapbox/satellite-v9"
const CAMPUS_ZOOM = 17

interface CampusAerialMapProps {
  schoolId: string
  label: string
  lat?: number
  lng?: number
  className?: string
}

export function CampusAerialMap({ schoolId, label, lat, lng, className }: CampusAerialMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  const coords = useMemo(() => {
    const geo = findGeoSchoolLocation(schoolId)
    if (geo) return geo
    if (lat != null && lng != null) return { lat, lng, name: label }
    return null
  }, [schoolId, lat, lng, label])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !coords) return
    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: AERIAL_STYLE,
      center: [coords.lng, coords.lat],
      zoom: CAMPUS_ZOOM,
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right")

    const el = document.createElement("div")
    el.className = "campus-aerial-marker"

    markerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([coords.lng, coords.lat])
      .setPopup(new mapboxgl.Popup({ offset: 18, closeButton: false }).setText(label))
      .addTo(map)

    mapRef.current = map

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !coords) return
    map.flyTo({ center: [coords.lng, coords.lat], zoom: CAMPUS_ZOOM, essential: true })
    markerRef.current?.setLngLat([coords.lng, coords.lat])
    markerRef.current?.getPopup()?.setText(label)
  }, [coords, label, schoolId])

  if (!coords) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-sm text-muted-foreground ${className ?? "h-full min-h-[420px] w-full"}`}
      >
        Campus location not found in GeoJSON.
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        className={className ?? "h-full min-h-[420px] w-full"}
        aria-label={`Aerial map of ${label} campus`}
      />
      <style jsx global>{`
        .campus-aerial-marker {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: var(--color-primary);
          border: 3px solid #fff;
          box-shadow: 0 0 0 4px color-mix(in oklch, var(--color-primary) 30%, transparent);
          cursor: pointer;
        }
        .mapboxgl-popup-content {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
        }
      `}</style>
    </>
  )
}
