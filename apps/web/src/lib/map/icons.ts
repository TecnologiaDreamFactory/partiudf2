import type { DivIcon, Icon } from 'leaflet';

/* eslint-disable no-unused-vars -- L.divIcon callback param in type */
const DREAM_BLUE = '#00c2ff';

const VAN_PIN_OPTIONS = {
  iconUrl: '/icons/van-pin-128x128.png',
  iconSize: [64, 64] as [number, number],
  iconAnchor: [32, 64] as [number, number],
  tooltipAnchor: [0, -18] as [number, number],
  popupAnchor: [0, -28] as [number, number],
};

/** Ícone PNG 3D da van (pin azul) - 128px source, 64px display para retina */
export function vanPinIcon(L: typeof import('leaflet')): Icon {
  return L.icon(VAN_PIN_OPTIONS);
}

/** Aceita avatarUrl relativo, ex: /avatars/p1.png */
function isSafeAvatarUrl(url: string): boolean {
  const t = url.trim();
  return t.length > 0 && t.startsWith('/') && !/[\s"'<>]/.test(t);
}

function getInitials(label: string): string {
  const t = (label || '').trim();
  if (!t) return '?';
  if (t.length <= 2) return t;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0].charAt(0).toUpperCase() + parts[parts.length - 1].charAt(0).toUpperCase()
    );
  }
  return t.charAt(0).toUpperCase();
}

export interface CreatePassengerIconOpts {
  label: string;
  avatarUrl?: string | null;
  highlight?: boolean;
}

/** Ícone de passageiro: avatar circular ou fallback iniciais */
export function createPassengerIcon(
  L: { divIcon: (_o: Record<string, unknown>) => DivIcon },
  opts: CreatePassengerIconOpts,
): DivIcon {
  const { label, avatarUrl, highlight } = opts;
  const initials = getInitials(label);
  const escaped = initials.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const title = (label || '').replace(/"/g, '&quot;');
  const safeUrl = avatarUrl && isSafeAvatarUrl(avatarUrl) ? avatarUrl.trim().replace(/"/g, '&quot;') : '';
  const inner = safeUrl
    ? `<img src="${safeUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : escaped;
  const badgeClass = highlight ? 'passenger-badge passenger-badge--highlight' : 'passenger-badge';
  return L.divIcon({
    className: 'passenger-marker leaflet-div-icon',
    html: `
      <div class="${badgeClass}" style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:30px;
        height:30px;
        background:white;
        border:2px solid ${DREAM_BLUE};
        border-radius:50%;
        overflow:hidden;
        color:#1f2937;
        font-size:11px;
        font-weight:600;
        font-family:inherit;
        box-shadow:0 2px 6px rgba(0,0,0,0.15);
        white-space:nowrap;
      " title="${title}">${inner}</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/** Ícone de pickup point: marcador cinza claro */
export function createPickupPointIcon(L: { divIcon: (_o: Record<string, unknown>) => DivIcon }, name: string): DivIcon {
  const escaped = (name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return L.divIcon({
    className: 'pickup-marker leaflet-div-icon',
    html: `
      <div style="
        width:12px;
        height:12px;
        background:#9ca3af;
        border:2px solid white;
        border-radius:50%;
        box-shadow:0 1px 3px rgba(0,0,0,0.2);
      " title="${escaped}"></div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}
