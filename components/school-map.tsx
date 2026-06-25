"use client"

import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { MAPBOX_TOKEN } from "@/lib/dashboard-data"

interface SchoolMapProps {
  lat: number
  lng: number
  label: string
}

export const SCHOOL_MAP_HEIGHT = 420

export function SchoolMap({ lat, lng, label }: SchoolMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: 14,
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right")

    const el = document.createElement("div")
    el.className = "school-marker"

    markerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 18, closeButton: false }).setText(label))
      .addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.flyTo({ center: [lng, lat], zoom: 14, essential: true })
    markerRef.current?.setLngLat([lng, lat])
    markerRef.current?.getPopup()?.setText(label)
  }, [lat, lng, label])

  return (
    <>
      <div ref={containerRef} className="w-full" style={{ height: SCHOOL_MAP_HEIGHT }} aria-label={`Map showing the location of ${label}`} />
      <style jsx global>{`
        .school-marker {
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
