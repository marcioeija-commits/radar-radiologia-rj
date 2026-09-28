import AsyncStorage from "@react-native-async-storage/async-storage";

const VIEWED_KEY = "@radar_radiologia_rj/viewed";

export async function getViewedIds(): Promise<string[]> {
  const value = await AsyncStorage.getItem(VIEWED_KEY);

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

export async function markAsViewed(id: string): Promise<string[]> {
  const viewed = await getViewedIds();

  if (viewed.includes(id)) {
    return viewed;
  }

  const next = [...viewed, id];

  await AsyncStorage.setItem(VIEWED_KEY, JSON.stringify(next));

  return next;
}
