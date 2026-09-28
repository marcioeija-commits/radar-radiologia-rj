import AsyncStorage from "@react-native-async-storage/async-storage";

const DELETED_KEY = "@radar_radiologia_rj/deleted";

export async function getDeletedIds(): Promise<string[]> {
  const value = await AsyncStorage.getItem(DELETED_KEY);

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

export async function markAsDeleted(id: string): Promise<string[]> {
  const deleted = await getDeletedIds();

  if (deleted.includes(id)) {
    return deleted;
  }

  const next = [...deleted, id];
  await AsyncStorage.setItem(DELETED_KEY, JSON.stringify(next));

  return next;
}
