import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

const ALERTS_KEY = "radar-alerts-enabled";

const activity = [
  { id: "1", time: "Agora", title: "Radar configurado para o RJ", body: "O app está pronto para acompanhar Técnico e Tecnólogo em Radiologia.", icon: "checkmark.seal.fill" as const, tone: "success" },
  { id: "2", time: "Hoje", title: "Fontes prioritárias selecionadas", body: "Diários oficiais, portais de concursos e empregadores da saúde.", icon: "doc.text.fill" as const, tone: "primary" },
  { id: "3", time: "Próximo passo", title: "Ative as notificações", body: "Assim vocês recebem o aviso quando houver uma nova publicação compatível.", icon: "bell.fill" as const, tone: "warning" },
];

export default function AlertsScreen() {
  const colors = useColors();
  const { user } = useAuth({ autoFetch: true });
  const registerDevice = trpc.monitoring.devices.register.useMutation();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ALERTS_KEY).then((value) => setEnabled(value === "true"));
  }, []);

  const toggleNotifications = async (value: boolean) => {
    if (!value) {
      setEnabled(false);
      await AsyncStorage.setItem(ALERTS_KEY, "false");
      return;
    }

    if (Platform.OS === "web") {
      setEnabled(true);
      await AsyncStorage.setItem(ALERTS_KEY, "true");
      return;
    }

    const { status: currentStatus } = await Notifications.getPermissionsAsync();
    let status = currentStatus;
    if (currentStatus !== "granted") {
      const response = await Notifications.requestPermissionsAsync();
      status = response.status;
    }

    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita notificações nos ajustes do celular para receber novos alertas.");
      return;
    }

    setEnabled(true);
    await AsyncStorage.setItem(ALERTS_KEY, "true");
    if (user) {
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (projectId) {
          const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
          await registerDevice.mutateAsync({ token, platform: Platform.OS === "ios" ? "ios" : "android" });
        }
      } catch (error) {
        console.warn("[Notifications] Failed to register push device", error);
      }
    }
    Alert.alert("Notificações ativadas", user ? "Este celular foi associado à conta do Radar." : "A permissão foi ativada neste celular. Entre na conta para compartilhar os alertas com outro aparelho.");
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <FlatList
        data={activity}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>CENTRAL DE ALERTAS</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Fique sabendo primeiro.</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Escolha como o Radar deve avisar vocês quando uma nova oportunidade aparecer.</Text>

            <View style={[styles.alertCard, { backgroundColor: colors.surface, borderColor: enabled ? colors.primary : colors.border }]}>
              <View style={[styles.alertIcon, { backgroundColor: enabled ? `${colors.primary}18` : `${colors.muted}18` }]}>
                <IconSymbol name="bell.fill" size={25} color={enabled ? colors.primary : colors.muted} />
              </View>
              <View style={styles.alertCopy}>
                <Text style={[styles.alertTitle, { color: colors.foreground }]}>Notificações push</Text>
                <Text style={[styles.alertBody, { color: colors.muted }]}>{enabled ? "Ativadas neste celular" : "Toque para ativar neste celular"}</Text>
              </View>
              <Switch value={enabled} onValueChange={toggleNotifications} trackColor={{ false: colors.border, true: `${colors.primary}88` }} thumbColor={enabled ? colors.primary : "#FFFFFF"} />
            </View>

            <View style={[styles.preferenceCard, { backgroundColor: colors.primary }]}>
              <View style={styles.preferenceHeader}>
                <Text style={styles.preferenceTitle}>Resumo do monitoramento</Text>
                <View style={styles.activePill}><Text style={styles.activePillText}>RJ ATIVO</Text></View>
              </View>
              <Text style={styles.preferenceBody}>Técnico e Tecnólogo em Radiologia • concursos, processos seletivos e vagas • todo o estado</Text>
              <View style={styles.preferenceFooter}>
                <Text style={styles.preferenceHint}>Altere filtros em Ajustes</Text>
                <IconSymbol name="chevron.right" size={16} color="#D9FFFB" />
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Atividade recente</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.activityRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.activityIcon, { backgroundColor: item.tone === "success" ? `${colors.success}18` : item.tone === "warning" ? `${colors.warning}18` : `${colors.primary}18` }]}>
              <IconSymbol name={item.icon} size={17} color={item.tone === "success" ? colors.success : item.tone === "warning" ? colors.warning : colors.primary} />
            </View>
            <View style={styles.activityCopy}>
              <Text style={[styles.activityTime, { color: colors.muted }]}>{item.time}</Text>
              <Text style={[styles.activityTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.activityBody, { color: colors.muted }]}>{item.body}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <Pressable onPress={() => Alert.alert("Tudo certo", "Quando o monitor encontrar uma nova publicação, ela aparecerá no Radar e será enviada para os celulares com as notificações ativas.")} style={({ pressed }) => [styles.testButton, { borderColor: colors.border }, pressed && styles.pressed]}>
            <IconSymbol name="paperplane.fill" size={16} color={colors.primary} />
            <Text style={[styles.testButtonText, { color: colors.primary }]}>Como os alertas vão funcionar?</Text>
          </Pressable>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 19, paddingBottom: 32 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8, marginTop: 5 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 21 },
  alertCard: { flexDirection: "row", alignItems: "center", borderRadius: 20, borderWidth: 1, padding: 15, marginBottom: 13 },
  alertIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  alertCopy: { flex: 1, marginLeft: 12 },
  alertTitle: { fontSize: 15, fontWeight: "800" },
  alertBody: { fontSize: 12, marginTop: 4 },
  preferenceCard: { borderRadius: 21, padding: 17, marginBottom: 25 },
  preferenceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preferenceTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  activePill: { backgroundColor: "#B9FFF5", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 },
  activePillText: { color: "#0F766E", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  preferenceBody: { color: "#D9FFFB", fontSize: 13, lineHeight: 19, marginTop: 12 },
  preferenceFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopColor: "#FFFFFF30", borderTopWidth: 1, paddingTop: 12, marginTop: 15 },
  preferenceHint: { color: "#B9FFF5", fontSize: 11, fontWeight: "700" },
  sectionTitle: { fontSize: 19, fontWeight: "800", marginBottom: 3 },
  activityRow: { flexDirection: "row", paddingVertical: 15, borderBottomWidth: 1, gap: 12 },
  activityIcon: { width: 35, height: 35, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  activityCopy: { flex: 1 },
  activityTime: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  activityTitle: { fontSize: 14, fontWeight: "800", marginTop: 3 },
  activityBody: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  testButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderRadius: 14, paddingVertical: 13, marginTop: 18 },
  testButtonText: { fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
