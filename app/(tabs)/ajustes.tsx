import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { getExistingInstallationCredentials } from "@/lib/installation";

const SETTINGS_KEY = "radar-settings";

type Settings = {
  concursos: boolean;
  processos: boolean;
  vagas: boolean;
  tecnico: boolean;
  tecnologo: boolean;
  todoEstado: boolean;
};

const defaultSettings: Settings = {
  concursos: true,
  processos: true,
  vagas: true,
  tecnico: true,
  tecnologo: true,
  todoEstado: true,
};

export default function SettingsScreen() {
  const colors = useColors();
  const { user } = useAuth({ autoFetch: true });
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const remotePreferences = trpc.monitoring.preferences.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const getDevicePreferences = trpc.monitoring.devices.getInstallationPreferences.useMutation();
  const saveDevicePreferences = trpc.monitoring.devices.saveInstallationPreferences.useMutation();
  const linkInstallation = trpc.monitoring.devices.linkInstallation.useMutation();
  const unlinkInstallation = trpc.monitoring.devices.unlinkInstallation.useMutation();
  const testNotification = trpc.monitoring.devices.testNotification.useMutation();
  const [isLinked, setIsLinked] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "current" | "error">("idle");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const getDevicePreferencesAsync = getDevicePreferences.mutateAsync;

  const sendTestNotification = async () => {
    const credentials = await getExistingInstallationCredentials();

    if (!credentials) {
      Alert.alert(
        "Ative as notificações primeiro",
        "Este aparelho ainda não foi cadastrado para receber notificações."
      );
      return;
    }

    try {
      await testNotification.mutateAsync(credentials);
      Alert.alert(
        "Teste enviado",
        "A notificação de teste foi enviada para este aparelho."
      );
    } catch (error) {
      Alert.alert(
        "Não foi possível enviar o teste",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const value = await AsyncStorage.getItem(SETTINGS_KEY);
      if (value && active) setSettings({ ...defaultSettings, ...JSON.parse(value) });
      const credentials = await getExistingInstallationCredentials();
      if (!credentials) return;
      try {
        const remote = await getDevicePreferencesAsync(credentials);
        if (!active) return;
        const next = {
          concursos: remote.concursos,
          processos: remote.processos,
          vagas: remote.vagas,
          tecnico: remote.tecnico,
          tecnologo: remote.tecnologo,
          todoEstado: remote.todoEstado,
        };
        setSettings(next);
        setIsLinked(remote.linked);
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Device may not be registered yet; local preferences remain available.
      }
    })();
    return () => { active = false; };
  }, [getDevicePreferencesAsync]);

  useEffect(() => {
    let active = true;
    void getExistingInstallationCredentials().then(async (credentials) => {
      if (!credentials) return;
      try {
        const remote = await getDevicePreferencesAsync(credentials);
        if (active) setIsLinked(remote.linked);
      } catch {
        if (active) setIsLinked(false);
      }
    });
    return () => { active = false; };
  }, [user, getDevicePreferencesAsync]);

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    const credentials = await getExistingInstallationCredentials();
    if (credentials) {
      try {
        await saveDevicePreferences.mutateAsync({ ...credentials, preferences: next });
      } catch (error) {
        console.warn("[Preferences] Could not save installation preferences remotely", error);
      }
    }
  };

  const connectOrSync = async () => {
    if (!user) {
      await startOAuthLogin();
      return;
    }
    const credentials = await getExistingInstallationCredentials();
    if (!credentials) {
      Alert.alert("Ative as notificações primeiro", "O vínculo opcional fica associado a uma instalação já cadastrada neste aparelho.");
      return;
    }
    const sync = async (syncMode: "account_to_device" | "device_to_account") => {
      try {
        if (syncMode === "account_to_device") {
          const result = await remotePreferences.refetch();
          if (!result.data) throw new Error("Não foi possível carregar as preferências da conta.");
          const next = {
            concursos: result.data.concursos,
            processos: result.data.processos,
            vagas: result.data.vagas,
            tecnico: result.data.tecnico,
            tecnologo: result.data.tecnologo,
            todoEstado: result.data.todoEstado,
          };
          await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          setSettings(next);
        }
        await linkInstallation.mutateAsync({ ...credentials, syncMode });
        setIsLinked(true);
        if (syncMode === "device_to_account") await remotePreferences.refetch();
        Alert.alert("Sincronização ativada", "As preferências serão sincronizadas entre as instalações vinculadas a esta conta.");
      } catch (error) {
        Alert.alert("Não foi possível sincronizar", error instanceof Error ? error.message : String(error));
      }
    };
    Alert.alert("Sincronização opcional", "Escolha quais preferências usar como ponto de partida.", [
      { text: "Preferências da conta", onPress: () => { void sync("account_to_device"); } },
      { text: "Preferências deste aparelho", onPress: () => { void sync("device_to_account"); } },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const checkForUpdate = async () => {
    setUpdateStatus("checking");
    setLatestVersion(null);

    try {
      const response = await fetch(
        "https://api.github.com/repos/marcioeija-commits/radar-radiologia-rj/releases/latest",
        {
          headers: {
            Accept: "application/vnd.github+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub respondeu ${response.status}.`);
      }

      const release = await response.json();
      const remoteVersion = String(release.tag_name ?? "").replace(/^v/, "");

      if (!remoteVersion) {
        throw new Error("A versão da Release não foi informada.");
      }

      setLatestVersion(remoteVersion);

      const currentVersion = Constants.expoConfig?.version ?? "1.0.3";
      const current = currentVersion.split(".").map(Number);
      const latest = remoteVersion.split(".").map(Number);

      const hasUpdate = latest.some((part, index) => {
        const currentPart = current[index] ?? 0;
        return part > currentPart;
      }) || latest.length > current.length;

      setUpdateStatus(hasUpdate ? "available" : "current");
    } catch (error) {
      console.warn("[Update] Could not check for updates", error);
      setUpdateStatus("error");
    }
  };

  const openUpdate = async () => {
    try {
      const response = await fetch(
        "https://api.github.com/repos/marcioeija-commits/radar-radiologia-rj/releases/latest",
        {
          headers: {
            Accept: "application/vnd.github+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub respondeu ${response.status}.`);
      }

      const release = await response.json();
      const apk = Array.isArray(release.assets)
        ? release.assets.find((asset: { name?: string }) => asset.name?.toLowerCase().endsWith(".apk"))
        : null;

      const url = apk?.browser_download_url;

      if (!url) {
        Alert.alert("Atualização indisponível", "O APK da nova versão ainda não foi publicado.");
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Não foi possível abrir", error instanceof Error ? error.message : String(error));
    }
  };

  const disconnectSync = async () => {
    const credentials = await getExistingInstallationCredentials();
    if (!credentials) return;
    try {
      await unlinkInstallation.mutateAsync(credentials);
      setIsLinked(false);
      Alert.alert("Sincronização desativada", "As preferências deste aparelho continuarão salvas localmente.");
    } catch (error) {
      Alert.alert("Não foi possível desvincular", error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>PERSONALIZE O RADAR</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Ajustes</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Deixe o app atento exatamente ao que importa para a carreira dela.</Text>

        <Pressable onPress={isLinked ? disconnectSync : connectOrSync} style={({ pressed }) => [styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
          <View style={[styles.accountIcon, { backgroundColor: `${colors.primary}18` }]}>
            <IconSymbol name="person.2.fill" size={23} color={colors.primary} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={[styles.accountTitle, { color: colors.foreground }]}>{isLinked ? "Sincronização ativada" : "Sincronizar preferências (opcional)"}</Text>
            <Text style={[styles.accountBody, { color: colors.muted }]}>{isLinked ? "Toque para desvincular este aparelho" : user ? "Escolha se quer vincular esta instalação" : "Faça login somente se quiser sincronizar"}</Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>O que monitorar</Text>
          <Text style={[styles.sectionHint, { color: colors.primary }]}>RJ</Text>
        </View>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow label="Concursos públicos" description="Editais e concursos com cargo de radiologia" value={settings.concursos} onValueChange={(value) => updateSetting("concursos", value)} colors={colors} />
          <SettingRow label="Processos seletivos" description="Contratações temporárias e emergenciais" value={settings.processos} onValueChange={(value) => updateSetting("processos", value)} colors={colors} />
          <SettingRow label="Vagas em saúde" description="Hospitais, clínicas e fundações" value={settings.vagas} onValueChange={(value) => updateSetting("vagas", value)} colors={colors} last={true} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24, marginBottom: 10 }]}>Cargos de interesse</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow label="Técnico em Radiologia" description="Inclui oportunidades para nível técnico" value={settings.tecnico} onValueChange={(value) => updateSetting("tecnico", value)} colors={colors} />
          <SettingRow label="Tecnólogo em Radiologia" description="Inclui oportunidades de nível superior" value={settings.tecnologo} onValueChange={(value) => updateSetting("tecnologo", value)} colors={colors} last={true} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24, marginBottom: 10 }]}>Região</Text>
        <Pressable onPress={() => updateSetting("todoEstado", !settings.todoEstado)} style={({ pressed }) => [styles.regionCard, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
          <View style={styles.regionIcon}><IconSymbol name="map.fill" size={21} color={colors.primary} /></View>
          <View style={styles.regionCopy}><Text style={styles.regionTitle}>Todo o estado do Rio de Janeiro</Text><Text style={styles.regionBody}>Capital, Baixada, Região Metropolitana, Norte, Noroeste, Serrana e Costa Verde</Text></View>
          <IconSymbol name={settings.todoEstado ? "checkmark.circle.fill" : "circle"} size={23} color="#FFFFFF" />
        </Pressable>

        <View style={[styles.sourceNote, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}33` }]}>
          <IconSymbol name="lock.shield.fill" size={19} color={colors.warning} />
          <Text style={[styles.sourceNoteText, { color: colors.muted }]}>As fontes oficiais serão conectadas na próxima etapa do app. Até lá, esta tela já guarda seus filtros neste celular.</Text>
        </View>

        <View style={[styles.testNotificationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.testNotificationCopy}>
            <Text style={[styles.testNotificationTitle, { color: colors.foreground }]}>Teste de notificação</Text>
            <Text style={[styles.testNotificationBody, { color: colors.muted }]}>
              Envie uma notificação real para confirmar que este aparelho está recebendo os alertas.
            </Text>
          </View>

          <Pressable
            onPress={() => { void sendTestNotification(); }}
            disabled={testNotification.isPending}
            style={({ pressed }) => [
              styles.testNotificationButton,
              { backgroundColor: colors.primary },
              testNotification.isPending && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.updateButtonText}>
              {testNotification.isPending ? "Enviando..." : "Testar notificação"}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.updateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.updateCopy}>
            <Text style={[styles.updateTitle, { color: colors.foreground }]}>Atualização do aplicativo</Text>
            <Text style={[styles.updateBody, { color: colors.muted }]}>
              {updateStatus === "checking"
                ? "Verificando se existe uma versão mais nova..."
                : updateStatus === "available"
                  ? `Nova versão ${latestVersion} disponível.`
                  : updateStatus === "current"
                    ? "Seu aplicativo já está atualizado."
                    : updateStatus === "error"
                      ? "Não foi possível verificar agora."
                      : "Confira se existe uma versão mais nova do Radar."}
            </Text>
          </View>

          {updateStatus === "available" ? (
            <Pressable
              onPress={() => { void openUpdate(); }}
              style={({ pressed }) => [
                styles.updateButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.updateButtonText}>Atualizar agora</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => { void checkForUpdate(); }}
              disabled={updateStatus === "checking"}
              style={({ pressed }) => [
                styles.updateButton,
                { backgroundColor: colors.primary },
                updateStatus === "checking" && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.updateButtonText}>
                {updateStatus === "checking" ? "Verificando..." : "Verificar atualização"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.versionBlock}>
          <Text style={[styles.versionLabel, { color: colors.muted }]}>Versão do aplicativo</Text>
          <Text style={[styles.versionValue, { color: colors.foreground }]}>
            {Constants.expoConfig?.version ?? "1.0.2"}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SettingRow({ label, description, value, onValueChange, colors, last = false }: { label: string; description: string; value: boolean; onValueChange: (value: boolean) => void; colors: ReturnType<typeof useColors>; last?: boolean }) {
  return (
    <View style={[styles.settingRow, !last && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View style={styles.settingCopy}><Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text><Text style={[styles.settingDescription, { color: colors.muted }]}>{description}</Text></View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: `${colors.primary}88` }} thumbColor={value ? colors.primary : "#FFFFFF"} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 19, paddingBottom: 32 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 29, fontWeight: "800", letterSpacing: -0.8, marginTop: 5 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 20 },
  accountCard: { flexDirection: "row", alignItems: "center", borderRadius: 20, borderWidth: 1, padding: 15, marginBottom: 24 },
  accountIcon: { width: 47, height: 47, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  accountCopy: { flex: 1, marginLeft: 12 },
  accountTitle: { fontSize: 14, fontWeight: "800" },
  accountBody: { fontSize: 11, marginTop: 4 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  sectionHint: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  settingsGroup: { borderWidth: 1, borderRadius: 19, paddingHorizontal: 15 },
  settingRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12 },
  settingCopy: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: "800" },
  settingDescription: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  regionCard: { flexDirection: "row", alignItems: "center", borderRadius: 19, padding: 15, gap: 11 },
  regionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  regionCopy: { flex: 1 },
  regionTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  regionBody: { color: "#E8F1FF", fontSize: 10, lineHeight: 15, marginTop: 4 },
  sourceNote: { flexDirection: "row", gap: 9, alignItems: "flex-start", padding: 13, borderRadius: 15, borderWidth: 1, marginTop: 17 },
  sourceNoteText: { flex: 1, fontSize: 11, lineHeight: 16 },
  testNotificationCard: {
    borderWidth: 1,
    borderRadius: 19,
    padding: 15,
    marginTop: 24,
  },
  testNotificationCopy: {
    marginBottom: 13,
  },
  testNotificationTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  testNotificationBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  testNotificationButton: {
    minHeight: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  updateCard: {
    borderWidth: 1,
    borderRadius: 19,
    padding: 15,
    marginTop: 24,
  },
  updateCopy: {
    marginBottom: 13,
  },
  updateTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  updateBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  updateButton: {
    minHeight: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.6,
  },
  versionBlock: { alignItems: "center", marginTop: 18, paddingBottom: 8 },
  versionLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.4 },
  versionValue: { fontSize: 12, fontWeight: "800", marginTop: 3 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
