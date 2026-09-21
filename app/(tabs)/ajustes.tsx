import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

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
  const saveRemotePreferences = trpc.monitoring.preferences.save.useMutation();

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((value) => {
      if (value) setSettings({ ...defaultSettings, ...JSON.parse(value) });
    });
  }, []);

  useEffect(() => {
    if (!remotePreferences.data) return;
    const next = {
      concursos: remotePreferences.data.concursos,
      processos: remotePreferences.data.processos,
      vagas: remotePreferences.data.vagas,
      tecnico: remotePreferences.data.tecnico,
      tecnologo: remotePreferences.data.tecnologo,
      todoEstado: remotePreferences.data.todoEstado,
    };
    setSettings(next);
    void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }, [remotePreferences.data]);

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    if (user) await saveRemotePreferences.mutateAsync(next);
  };

  const connectAnotherPhone = async () => {
    if (user) {
      Alert.alert("Conta conectada", "Entre com a mesma conta no outro celular para compartilhar suas preferências e alertas.");
      return;
    }
    await startOAuthLogin();
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>PERSONALIZE O RADAR</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Ajustes</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Deixe o app atento exatamente ao que importa para a carreira dela.</Text>

        <Pressable onPress={connectAnotherPhone} style={({ pressed }) => [styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
          <View style={[styles.accountIcon, { backgroundColor: `${colors.primary}18` }]}>
            <IconSymbol name="person.2.fill" size={23} color={colors.primary} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={[styles.accountTitle, { color: colors.foreground }]}>{user ? "Conta do casal conectada" : "Conectar os dois celulares"}</Text>
            <Text style={[styles.accountBody, { color: colors.muted }]}>{user ? "Preferências prontas para sincronizar" : "Use a mesma conta no iPhone e no Android"}</Text>
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
  regionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#DDFCF8", alignItems: "center", justifyContent: "center" },
  regionCopy: { flex: 1 },
  regionTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  regionBody: { color: "#D9FFFB", fontSize: 10, lineHeight: 15, marginTop: 4 },
  sourceNote: { flexDirection: "row", gap: 9, alignItems: "flex-start", padding: 13, borderRadius: 15, borderWidth: 1, marginTop: 17 },
  sourceNoteText: { flex: 1, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
