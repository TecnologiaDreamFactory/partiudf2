'use client';

import { useEffect, useRef, useState } from 'react';
import { vanPinIcon, createPassengerIcon, createPickupPointIcon } from '@/lib/map/icons';
import { chooseInitialCenter, safeFollow } from '@/lib/map/utils';
import { MARINA_CENTER, DEFAULT_ZOOM } from '@/lib/map/constants';
import { TimeAgo } from '@/components/TimeAgo';

export interface MapPosition {
  lat: number;
  lng: number;
}

export interface VanPositionExtended extends MapPosition {
  accuracy?: number;
  heading?: number | null;
  fromSnapshot?: boolean;
}

export interface PassengerMarker {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  label: string;
  avatarUrl?: string | null;
  pickupPointName?: string | null;
}

export interface PickupPointMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

export type MapHudStatus = 'live' | 'weak' | 'off';

interface MapViewProps {
  vanPosition?: VanPositionExtended | MapPosition | null;
  passengerMarkers?: PassengerMarker[];
  pickupPoints?: PickupPointMarker[];
  followVan?: boolean;
  tripId?: string | null;
  vanTooltip?: string;
  lastVanUpdateAt?: number | null;
  focusUserId?: string | null;
  className?: string;
}

function getHudStatus(lastVanUpdateAt: number | null | undefined): MapHudStatus {
  if (lastVanUpdateAt == null) return 'off';
  const secs = Math.round((Date.now() - lastVanUpdateAt) / 1000);
  if (secs <= 5) return 'live';
  if (secs <= 15) return 'weak';
  return 'off';
}

export function MapView({
  vanPosition = null,
  passengerMarkers = [],
  pickupPoints = [],
  followVan = true,
  tripId = null,
  vanTooltip = 'Van',
  lastVanUpdateAt = null,
  focusUserId = null,
  className = '',
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userGeo, setUserGeo] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const appliedBestReasonRef = useRef<'van' | 'user' | null>(null);
  const mapRef = useRef<{
    map: import('leaflet').Map;
    vanMarker: import('leaflet').Marker;
    passengerMarkerLayer: import('leaflet').LayerGroup;
    pickupLayer: import('leaflet').LayerGroup;
    passengerMarkersByUserId: Map<string, import('leaflet').Marker>;
  } | null>(null);

  // Fetch user geolocation on mount (for chooseInitialCenter)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGeo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    );
  }, []);

  // Init map: always start at Marina da Glória (fallback)
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    let mounted = true;
    appliedBestReasonRef.current = null;

    const init = async () => {
      const L = await import('leaflet');

      if (!mounted || !containerRef.current) return;

      const map = L.map(containerRef.current).setView(
        [MARINA_CENTER.lat, MARINA_CENTER.lng],
        DEFAULT_ZOOM,
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const vanMarker = L.marker([MARINA_CENTER.lat, MARINA_CENTER.lng], {
        icon: vanPinIcon(L),
        zIndexOffset: 1000,
      });

      vanMarker.bindTooltip(vanTooltip, {
        permanent: false,
        direction: 'top',
        offset: [0, -18],
      });

      const passengerMarkerLayer = L.layerGroup().addTo(map);
      const pickupLayer = L.layerGroup().addTo(map);

      mapRef.current = { map, vanMarker, passengerMarkerLayer, pickupLayer, passengerMarkersByUserId: new Map() };

      setTimeout(() => {
        map.invalidateSize();
        setMapReady(true);
      }, 50);
    };

    init();

    return () => {
      mounted = false;
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
  }, [vanTooltip]);

  // Apply smart initial center when we get lastLocation or userGeo (upgrade from Marina)
  useEffect(() => {
    const ref = mapRef.current;
    if (!ref || !mapReady) return;

    const lastLocation =
      vanPosition && 'fromSnapshot' in vanPosition && vanPosition.fromSnapshot
        ? { lat: vanPosition.lat, lng: vanPosition.lng }
        : null;

    const result = chooseInitialCenter({ lastLocation, userGeo });
    if (result.reason === 'marina') return;

    const applied = appliedBestReasonRef.current;
    if (result.reason === 'van') {
      ref.map.setView([result.lat, result.lng], result.zoom);
      setTimeout(() => ref.map.invalidateSize(), 50);
      appliedBestReasonRef.current = 'van';
    } else if (result.reason === 'user' && applied !== 'van') {
      ref.map.setView([result.lat, result.lng], result.zoom);
      setTimeout(() => ref.map.invalidateSize(), 50);
      appliedBestReasonRef.current = 'user';
    }
  }, [mapReady, vanPosition, userGeo]);

  // invalidateSize on mount and when trip changes
  useEffect(() => {
    const ref = mapRef.current;
    if (!ref) return;
    const t = setTimeout(() => {
      ref.map.invalidateSize();
    }, 50);
    return () => clearTimeout(t);
  }, [tripId]);

  // Van marker: show/update when vanPosition, remove when null
  useEffect(() => {
    const ref = mapRef.current;
    if (!ref || !mapReady) return;

    if (!vanPosition) {
      if (ref.map.hasLayer(ref.vanMarker)) {
        ref.map.removeLayer(ref.vanMarker);
      }
      return;
    }

    if (!ref.map.hasLayer(ref.vanMarker)) {
      ref.vanMarker.addTo(ref.map);
    }

    const lat = vanPosition.lat;
    const lng = vanPosition.lng;
    ref.vanMarker.setLatLng([lat, lng]);

    // PanTo (follow) só quando accuracy <= 200m; marker sempre atualiza.
    const accuracy = 'accuracy' in vanPosition ? vanPosition.accuracy : undefined;
    const accuracyOkForFollow = accuracy == null || accuracy <= 200;
    if (followVan && accuracyOkForFollow) {
      safeFollow(ref.map, lat, lng);
    }
  }, [vanPosition, followVan, mapReady]);

  // Passenger markers (upsert/remove by userId)
  useEffect(() => {
    const ref = mapRef.current;
    if (!ref) return;

    void import('leaflet').then((LMod) => {
      const L = LMod.default;
      const layer = ref!.passengerMarkerLayer;
      const byUserId = ref!.passengerMarkersByUserId;

      const currentUserIds = new Set(passengerMarkers.map((p) => p.userId));

      // Remove markers que não estão mais na lista
      byUserId.forEach((marker, userId) => {
        if (!currentUserIds.has(userId)) {
          layer.removeLayer(marker);
          byUserId.delete(userId);
        }
      });

      // Add/update
      passengerMarkers.forEach((pm) => {
        const existing = byUserId.get(pm.userId);
        const icon = createPassengerIcon(L, {
          label: pm.label,
          avatarUrl: pm.avatarUrl,
          highlight: pm.userId === focusUserId,
        });
        const tooltipText = pm.pickupPointName
          ? `${pm.label} (${pm.pickupPointName})`
          : pm.label;

        if (existing) {
          existing.setLatLng([pm.lat, pm.lng]);
          existing.setIcon(icon);
          existing.setZIndexOffset(500);
          const tip = existing.getTooltip();
          if (tip) tip.setContent(tooltipText);
          else existing.bindTooltip(tooltipText, { permanent: false, direction: 'top', offset: [0, -15] });
        } else {
          const marker = L.marker([pm.lat, pm.lng], { icon, zIndexOffset: 500 });
          marker.bindTooltip(tooltipText, { permanent: false, direction: 'top', offset: [0, -15] });
          layer.addLayer(marker);
          byUserId.set(pm.userId, marker);
        }
      });
    });
  }, [passengerMarkers, focusUserId]);

  // Focus on passenger marker (pan + open tooltip)
  useEffect(() => {
    const ref = mapRef.current;
    if (!ref || !mapReady || !focusUserId) return;
    const marker = ref.passengerMarkersByUserId.get(focusUserId);
    if (!marker) return;
    const latLng = marker.getLatLng();
    ref.map.panTo(latLng);
    marker.openTooltip();
  }, [mapReady, focusUserId, passengerMarkers]);

  // Pickup point markers (static)
  useEffect(() => {
    const ref = mapRef.current;
    if (!ref) return;

    ref.pickupLayer.clearLayers();

    if (pickupPoints.length === 0) return;

    void import('leaflet').then((LMod) => {
      const L = LMod.default;
      pickupPoints.forEach((pp) => {
        const marker = L.marker([pp.lat, pp.lng], {
          icon: createPickupPointIcon(L, pp.name),
          zIndexOffset: 100,
        });
        marker.bindTooltip(pp.name, { permanent: false, direction: 'top', offset: [0, -8] });
        ref!.pickupLayer.addLayer(marker);
      });
    });
  }, [pickupPoints]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-df-border bg-df-surface shadow-soft h-[55vh] min-h-[360px] sm:h-[520px] ${className}`}
      style={{ width: '100%', height: '100%' }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
        aria-label="Mapa"
      />
      <MapHud lastVanUpdateAt={lastVanUpdateAt} />
    </div>
  );
}

/**
 * HUD do mapa: status + última atualização. Isolado em seu próprio componente
 * para que o tick por segundo não dispare re-render do MapView inteiro.
 */
function MapHud({ lastVanUpdateAt }: { lastVanUpdateAt: number | null | undefined }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (lastVanUpdateAt == null) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [lastVanUpdateAt]);

  const hudStatus = getHudStatus(lastVanUpdateAt);
  const hudStatusText =
    hudStatus === 'live' ? 'Ao vivo' : hudStatus === 'weak' ? 'Sinal fraco' : 'Sem sinal';
  const hudStatusColor =
    hudStatus === 'live'
      ? 'text-emerald-600 dark:text-emerald-400'
      : hudStatus === 'weak'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-df-muted';

  return (
    <div className="pointer-events-none absolute right-2 top-2 min-w-[140px] rounded-lg border border-df-border bg-df-surface/95 px-3 py-2 text-right shadow-soft backdrop-blur-sm">
      <div className={`text-sm font-medium ${hudStatusColor}`}>{hudStatusText}</div>
      <div className="text-xs text-df-muted">
        {lastVanUpdateAt != null ? (
          <TimeAgo from={lastVanUpdateAt} prefix="Atualizado " />
        ) : (
          'Aguardando…'
        )}
      </div>
    </div>
  );
}
