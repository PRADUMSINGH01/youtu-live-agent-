export interface MusicTrack {
  id: string;
  title: string;
  duration: number; // in seconds
  audioUrl: string;
  coverUrl?: string;
  genre?: string;
  categories: string[];
  tags: string[];
  isPremium: boolean;
  artists: string[];
}

export interface FetchMusicOptions {
  limit?: number;
  offset?: number;
  freeOnly?: boolean;
  genre?: string; // Filter by genre (e.g., 'Jazz', 'Instrumental', 'Hip Hop', 'Classical', 'Electronic', 'Lofi')
}

interface Category {
  id: string;
  name: string;
  type: string;
  description: string;
}

// In-memory cache for categories to avoid repeated API requests
let cachedCategories: Category[] | null = null;

/**
 * Fetch all available music categories (Mood, Genre, Video types)
 */
export async function fetchCategories(): Promise<Category[]> {
  if (cachedCategories) {
    return cachedCategories;
  }

  const response = await fetch('https://api.freetouse.com/v3/music/categories/all');
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }

  const json = await response.json();
  cachedCategories = (json.data || []).map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    type: cat.type,
    description: cat.description,
  }));

  return cachedCategories || [];
}

function parseRawTracks(rawTracks: any[], fallbackGenre?: string): MusicTrack[] {
  return rawTracks
    .map((t) => {
      // Extract artist names
      const artists: string[] = [];
      if (Array.isArray(t.artists)) {
        t.artists.forEach((item: any) => {
          if (Array.isArray(item) && item[1]?.name) {
            artists.push(item[1].name);
          } else if (item?.name) {
            artists.push(item.name);
          }
        });
      }

      // Extract categories
      const trackCategories: string[] = [];
      if (Array.isArray(t.categories)) {
        t.categories.forEach((item: any) => {
          if (Array.isArray(item) && item[1]?.name) {
            trackCategories.push(item[1].name);
          } else if (item?.name) {
            trackCategories.push(item.name);
          }
        });
      }

      // Extract tags
      const tags: string[] = [];
      if (Array.isArray(t.tags)) {
        t.tags.forEach((item: any) => {
          if (Array.isArray(item) && typeof item[1] === 'string') {
            tags.push(item[1]);
          } else if (typeof item === 'string') {
            tags.push(item);
          }
        });
      }

      return {
        id: t.id,
        title: t.title,
        duration: Math.round(t.duration || 0),
        audioUrl: t.files?.mp3 || '',
        coverUrl: t.thumbnails?.md || t.thumbnails?.lg || t.thumbnails?.sm,
        genre: t.genre || fallbackGenre || '',
        categories: trackCategories,
        tags,
        isPremium: Boolean(t.is_premium),
        artists,
      };
    })
    .filter((t) => Boolean(t.audioUrl));
}

async function fetchTracksForCategoryId(categoryId: string, limit: number, offset: number, fallbackGenre?: string): Promise<MusicTrack[]> {
  const url = `https://api.freetouse.com/v3/music/categories/${categoryId}/tracks?limit=${limit}&offset=${offset}`;
  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }
  const json = await response.json();
  return parseRawTracks(json.data || [], fallbackGenre);
}

/**
 * Fetch royalty-free music tracks for the agent.
 * @param query Category name, mood, or genre keyword (e.g., 'lofi', 'chill', 'relaxing', 'gaming', 'ambient', 'all')
 * @param options Optional limit, offset, freeOnly, and genre filter
 */
export async function fetchMusic(
  query: string = 'chill',
  options: FetchMusicOptions = {}
): Promise<MusicTrack[]> {
  const { limit = 10, offset = 0, freeOnly = true, genre } = options;

  const categories = await fetchCategories();
  const normalizedQuery = query.toLowerCase().trim();

  // Find best matching category for query
  let selectedCategory = categories.find((c) =>
    c.name.toLowerCase() === normalizedQuery
  );

  if (!selectedCategory && normalizedQuery !== 'all') {
    selectedCategory = categories.find((c) =>
      c.name.toLowerCase().includes(normalizedQuery) ||
      c.description.toLowerCase().includes(normalizedQuery)
    );
  }

  // If query didn't match but genre was given, try matching genre category directly
  if (!selectedCategory && genre) {
    const normalizedGenre = genre.toLowerCase().trim();
    selectedCategory = categories.find((c) =>
      c.name.toLowerCase() === normalizedGenre ||
      c.name.toLowerCase().includes(normalizedGenre)
    );
  }

  if (!selectedCategory) {
    selectedCategory = categories.find((c) => c.name.toLowerCase() === 'chill') || categories[0];
  }

  const batchSize = genre ? Math.max(limit * 4, 30) : limit * 2;
  let tracks = await fetchTracksForCategoryId(selectedCategory.id, batchSize, offset, selectedCategory.name);

  if (freeOnly) {
    tracks = tracks.filter((t) => !t.isPremium);
  }

  // Filter by genre if specified
  if (genre) {
    const targetGenre = genre.toLowerCase().trim();
    let filteredTracks = tracks.filter((t) =>
      t.genre.toLowerCase().includes(targetGenre) ||
      t.categories.some((c) => c.toLowerCase().includes(targetGenre)) ||
      t.tags.some((tag) => tag.toLowerCase().includes(targetGenre))
    );

    // If initial category didn't contain matching genre tracks, fallback to the dedicated genre category
    if (filteredTracks.length === 0) {
      const genreCategory = categories.find((c) =>
        c.name.toLowerCase() === targetGenre ||
        c.name.toLowerCase().includes(targetGenre)
      );

      if (genreCategory && genreCategory.id !== selectedCategory.id) {
        const fallbackTracks = await fetchTracksForCategoryId(genreCategory.id, batchSize, offset, genreCategory.name);
        const freeFallback = freeOnly ? fallbackTracks.filter((t) => !t.isPremium) : fallbackTracks;
        filteredTracks = freeFallback.filter((t) =>
          t.genre.toLowerCase().includes(targetGenre) ||
          t.categories.some((c) => c.toLowerCase().includes(targetGenre)) ||
          t.tags.some((tag) => tag.toLowerCase().includes(targetGenre)) ||
          t.genre.length > 0 // in dedicated category, all tracks are relevant
        );
      }
    }

    tracks = filteredTracks;
  }

  return tracks.slice(0, limit);
}


