import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const INSTALLATION_ID_KEY = "radar-anonymous-installation-id";
const SECRET_KEY_PREFIX = "radar-installation-secret-";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InstallationCredentials = {
  installationId: string;
  secret: string;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function getExistingInstallationCredentials(): Promise<InstallationCredentials | null> {
  let installationId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (!installationId || !UUID_PATTERN.test(installationId)) return null;
  const secret = await SecureStore.getItemAsync(`${SECRET_KEY_PREFIX}${installationId}`);
  return secret ? { installationId, secret } : null;
}

export async function getInstallationCredentials(): Promise<InstallationCredentials> {
  let installationId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (!installationId || !UUID_PATTERN.test(installationId)) {
    // Older app versions used a weakly generated ID; preserve their server row as legacy.
    installationId = Crypto.randomUUID();
    await AsyncStorage.setItem(INSTALLATION_ID_KEY, installationId);
  }

  const key = `${SECRET_KEY_PREFIX}${installationId}`;
  let secret = await SecureStore.getItemAsync(key);
  if (!secret) {
    secret = bytesToHex(await Crypto.getRandomBytesAsync(32));
    await SecureStore.setItemAsync(key, secret, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return { installationId, secret };
}
