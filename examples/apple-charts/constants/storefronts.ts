import type { ChartKind } from '@/lib/appleMusic';

export interface Storefront {
  code: string;
  name: string;
  flag: string;
}

export const STOREFRONTS: Storefront[] = [
  { code: 'us', name: 'United States', flag: '🇺🇸' },
  { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'ca', name: 'Canada', flag: '🇨🇦' },
  { code: 'au', name: 'Australia', flag: '🇦🇺' },
  { code: 'de', name: 'Germany', flag: '🇩🇪' },
  { code: 'fr', name: 'France', flag: '🇫🇷' },
  { code: 'jp', name: 'Japan', flag: '🇯🇵' },
  { code: 'kr', name: 'South Korea', flag: '🇰🇷' },
  { code: 'br', name: 'Brazil', flag: '🇧🇷' },
  { code: 'mx', name: 'Mexico', flag: '🇲🇽' },
  { code: 'in', name: 'India', flag: '🇮🇳' },
  { code: 'it', name: 'Italy', flag: '🇮🇹' },
  { code: 'es', name: 'Spain', flag: '🇪🇸' },
  { code: 'nl', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'se', name: 'Sweden', flag: '🇸🇪' },
  { code: 'nz', name: 'New Zealand', flag: '🇳🇿' },
];

export const DEFAULT_STOREFRONT = STOREFRONTS[0];

export interface ChartTypeOption {
  kind: ChartKind;
  label: string;
  singular: string;
}

export const CHART_TYPES: ChartTypeOption[] = [
  { kind: 'songs', label: 'Songs', singular: 'Song' },
  { kind: 'albums', label: 'Albums', singular: 'Album' },
  { kind: 'music-videos', label: 'Videos', singular: 'Music Video' },
  { kind: 'playlists', label: 'Playlists', singular: 'Playlist' },
];
