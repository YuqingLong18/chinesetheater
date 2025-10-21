import { useEffect, useRef } from 'react';
import type { LifeJourneyLocation } from '../types';

declare global {
  interface Window {
    L?: any;
  }
}

interface LifeJourneyMapProps {
  locations: LifeJourneyLocation[];
  onSelect: (location: LifeJourneyLocation | null) => void;
}

const LifeJourneyMap = ({ locations, onSelect }: LifeJourneyMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any>(null);

  useEffect(() => {
    const ensureAssets = async () => {
      if (window.L) {
        initMap();
        return;
      }

      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
        link.setAttribute('data-leaflet', 'true');
        document.head.appendChild(link);
      }

      if (!document.querySelector('script[data-leaflet]')) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.setAttribute('data-leaflet', 'true');
          document.body.appendChild(script);
        });
      }

      initMap();
    };

    const initMap = () => {
      if (!containerRef.current || !window.L) {
        return;
      }

      if (!mapRef.current) {
        const L = window.L;
        const first = locations[0];
        mapRef.current = L.map(containerRef.current, {
          center: [first.latitude, first.longitude],
          zoom: 5,
          minZoom: 4,
          maxZoom: 8
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '人生行迹图'
        }).addTo(mapRef.current);
      }

      redrawLayers();
    };

    const redrawLayers = () => {
      if (!mapRef.current || !window.L) {
        return;
      }
      const L = window.L;
      if (layersRef.current) {
        layersRef.current.remove();
      }
      const layer = L.layerGroup();
      layer.addTo(mapRef.current);
      layersRef.current = layer;

      const markerIcon = L.divIcon({
        className: 'journey-marker',
        html: '<div style="background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%); border: 2px solid white; border-radius: 50%; width: 18px; height: 18px; box-shadow: 0 1px 6px rgba(0,0,0,0.3);"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const bounds: Array<[number, number]> = [];

      locations.forEach((location) => {
        bounds.push([location.latitude, location.longitude]);
        const marker = L.marker([location.latitude, location.longitude], { icon: markerIcon }).addTo(layer);
        marker.bindPopup(
          `<div style="min-width: 140px; font-size: 12px;">
            <strong style=\"color:#2563eb;\">${location.name}</strong><br/>
            <span>${location.period}</span>
          </div>`
        );
        marker.on('click', () => onSelect(location));
      });

      if (locations.length > 1) {
        L.polyline(
          locations.map((loc) => [loc.latitude, loc.longitude]),
          {
            color: '#38bdf8',
            weight: 2,
            dashArray: '6, 8',
            lineCap: 'round',
            opacity: 0.7
          }
        ).addTo(layer);
      }

      if (bounds.length > 1) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      } else {
        mapRef.current.setView(bounds[0], 6);
      }
    };

    ensureAssets();

    return () => {
      if (layersRef.current) {
        layersRef.current.remove();
        layersRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [locations, onSelect]);

  return <div ref={containerRef} className="h-full w-full" />;
};

export default LifeJourneyMap;
