import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITES_KEY = "@radar_radiologia_rj/favorites";

export async function getFavoriteIds(): Promise<string[]> {
  const value = await AsyncStorage.getItem(FAVORITES_KEY);

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export async function isFavorite(id: string): Promise<boolean> {
  const favorites = await getFavoriteIds();
  return favorites.includes(id);
}

export async function setFavorite(id: string, favorite: boolean): Promise<string[]> {
  const favorites = await getFavoriteIds();

  const next = favorite
    ? Array.from(new Set([...favorites, id]))
    : favorites.filter((favoriteId) => favoriteId !== id);

  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));

  return next;
}
