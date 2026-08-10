export type ChartKind = 'songs' | 'albums' | 'music-videos' | 'playlists';

export interface Genre {
  genreId: string;
  name: string;
  url: string;
}

export interface ChartItem {
  id: string;
  name: string;
  artistName?: string;
  kind: ChartKind;
  releaseDate?: string;
  artworkUrl100: string;
  url: string;
  genres: Genre[];
}

interface RawChartResult {
  id: string;
  name: string;
  artistName?: string;
  kind: string;
  releaseDate?: string;
  artworkUrl100: string;
  url: string;
  genres?: Genre[];
}

interface RawChartResponse {
  feed: {
    title: string;
    results: RawChartResult[];
  };
}

/** Apple's free, unauthenticated RSS charts feed. No API key, no developer account. */
export async function fetchChart(
  storefront: string,
  kind: ChartKind,
  limit = 50
): Promise<ChartItem[]> {
  const url = `https://rss.marketingtools.apple.com/api/v2/${storefront}/music/most-played/${limit}/${kind}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Chart request failed (${response.status})`);
  }
  const data: RawChartResponse = await response.json();
  return data.feed.results.map((r) => ({
    id: r.id,
    name: r.name,
    artistName: r.artistName,
    kind: kind,
    releaseDate: r.releaseDate,
    artworkUrl100: r.artworkUrl100,
    url: r.url,
    genres: r.genres ?? [],
  }));
}

export interface TrackDetails {
  previewUrl?: string;
  trackTimeMillis?: number;
  collectionName?: string;
  primaryGenreName?: string;
  trackPrice?: number;
  currency?: string;
}

interface ItunesLookupResponse {
  resultCount: number;
  results: TrackDetails[];
}

/** Apple's free, unauthenticated iTunes Lookup API — enriches a chart item with a 30s preview. */
export async function fetchTrackDetails(
  id: string,
  storefront: string
): Promise<TrackDetails | null> {
  const url = `https://itunes.apple.com/lookup?id=${id}&country=${storefront}`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data: ItunesLookupResponse = await response.json();
  return data.results[0] ?? null;
}

export function artworkUrl(baseUrl: string | undefined, size: number): string {
  if (!baseUrl) return '';
  return baseUrl.replace(/\/\d+x\d+bb\.(jpg|png)$/, `/${size}x${size}bb.$1`);
}
