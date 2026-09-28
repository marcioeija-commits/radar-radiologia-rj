import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { filterOpportunities, ROLE_FILTERS, type Opportunity, type RoleFilter } from "@/shared/monitoring";
import { trpc } from "@/lib/trpc";
import { getFavoriteIds, setFavorite } from "@/lib/favorites";
import { getViewedIds, markAsViewed } from "@/lib/viewed";
import { getDeletedIds, markAsDeleted } from "@/lib/deleted";

export default function HomeScreen() {
  const colors = useColors();
  const liveQuery = trpc.monitoring.opportunities.useQuery(undefined, { retry: false });
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("Todos");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("agora");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [viewFilter, setViewFilter] = useState<"Todas" | "Não vistas" | "Vistas" | "Favoritos">("Todas");
  const [bellAnimation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    getFavoriteIds().then((ids) => {
      if (active) setFavoriteIds(ids);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getViewedIds(), getDeletedIds()]).then(([viewed, deleted]) => {
      if (active) {
        setViewedIds(viewed);
        setDeletedIds(deleted);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const opportunities = useMemo<Opportunity[]>(() => {
    if (!liveQuery.data?.length) return [];
    return liveQuery.data.map((item) => ({
      id: String(item.id),
      title: item.title,
      organization: item.organization,
      city: item.city,
      role: item.role === "Tecnólogo" ? "Tecnólogo" : "Técnico",
      kind: item.kind === "Processo seletivo" ? "Processo seletivo" : item.kind === "Concurso" ? "Concurso" : "Vaga",
      published: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("pt-BR") : "Novo alerta",
      deadline: item.deadlineAt ? new Date(item.deadlineAt).toLocaleDateString("pt-BR") : "Confira a publicação",
      source: item.organization,
      sourceUrl: item.sourceUrl,
    }));
  }, [liveQuery.data]);
  const filteredOpportunities = useMemo(() => {
    const roleFiltered = filterOpportunities(opportunities, roleFilter);
    return roleFiltered.filter((item) => {
      if (deletedIds.includes(item.id)) return false;
      const viewed = viewedIds.includes(item.id);
      const favorite = favoriteIds.includes(item.id);
      if (viewFilter === "Não vistas") return !viewed;
      if (viewFilter === "Vistas") return viewed;
      if (viewFilter === "Favoritos") return favorite;
      return true;
    });
  }, [opportunities, roleFilter, viewFilter, viewedIds, favoriteIds, deletedIds]);

  const hasUnreadOpportunities = opportunities.some(
    (item) => !viewedIds.includes(item.id) && !deletedIds.includes(item.id),
  );

  const bellRotation = bellAnimation.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-14deg", "14deg"],
  });

  useEffect(() => {
    if (!hasUnreadOpportunities) {
      bellAnimation.stopAnimation();
      bellAnimation.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bellAnimation, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(bellAnimation, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(bellAnimation, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(bellAnimation, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(bellAnimation, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [hasUnreadOpportunities, bellAnimation]);

  const toggleFavorite = async (id: string) => {
    const isCurrentlyFavorite = favoriteIds.includes(id);
    const next = await setFavorite(id, !isCurrentlyFavorite);
    setFavoriteIds(next);
  };

  const markOpportunityAsViewed = async (id: string) => {
    const next = await markAsViewed(id);
    setViewedIds(next);
  };

  const deleteOpportunity = (id: string) => {
    Alert.alert(
      "Excluir oportunidade?",
      "Ela será removida somente deste aparelho.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            void markAsDeleted(id).then((next) => setDeletedIds(next));
          },
        },
      ],
    );
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await liveQuery.refetch();
      setLastUpdated("agora");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <FlatList
        data={filteredOpportunities}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.topRow}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>RADAR RADIOLOGIA RJ</Text>
                <Text style={[styles.greeting, { color: colors.foreground }]}>OPORTUNIDADES PARA CÍNTIA</Text>
                <View style={styles.authorBlock}>
                  <Text style={[styles.dedication, { color: colors.primary }]}>Criado por Márcio Negão</Text>
                </View>
              </View>
              <View style={[styles.liveDot, { backgroundColor: colors.success }]}>
                <Animated.View style={{ transform: [{ rotate: bellRotation }] }}>
                  <IconSymbol name="bell.fill" size={19} color="#FFFFFF" />
                </Animated.View>
              </View>
            </View>

            <View style={[styles.heroCard, { backgroundColor: colors.primary }]}> 
              <View style={styles.heroCopy}>
                <Text style={styles.heroKicker}>MONITORAMENTO DO RJ</Text>
                <Text style={styles.heroTitle}>Não deixe uma boa vaga passar.</Text>
                <Text style={styles.heroBody}>
                  Acompanhe concursos e oportunidades para técnico e tecnólogo em radiologia em um só lugar.
                </Text>
              </View>
              <View style={styles.heroBadge}>
                <IconSymbol name="radiowaves.left" size={28} color={colors.primary} />
              </View>
            </View>

            <View style={styles.infoStrip}>
              <IconSymbol name="info.circle.fill" size={16} color={colors.warning} />
              <Text style={[styles.infoText, { color: colors.muted }]}>
                {liveQuery.isLoading
                  ? "Consultando as oportunidades monitoradas..."
                  : liveQuery.data?.length
                    ? "Monitoramento ativo: oportunidades reais encontradas."
                    : "Nenhuma oportunidade encontrada no momento. O radar continuará monitorando as fontes oficiais."}
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Oportunidades</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>Filtradas para o estado do Rio de Janeiro</Text>
              </View>
              <Pressable onPress={refresh} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
                <IconSymbol name="arrow.clockwise" size={17} color={colors.primary} />
                <Text style={[styles.refreshText, { color: colors.primary }]}>Atualizar</Text>
              </Pressable>
            </View>

            <View style={styles.filterRow}>
              {ROLE_FILTERS.map((filter) => {
                const active = roleFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    onPress={() => setRoleFilter(filter)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.filterText, { color: active ? "#FFFFFF" : colors.muted }]}>{filter}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.filterRow}>
              {["Todas", "Não vistas", "Vistas", "Favoritos"].map((filter) => {
                const active = viewFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    onPress={() => setViewFilter(filter as typeof viewFilter)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.filterText, { color: active ? "#FFFFFF" : colors.muted }]}>{filter}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryNumber, { color: colors.primary }]}>RJ</Text>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>região ativa</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="checkmark.seal.fill" size={23} color={colors.success} />
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>filtros salvos</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryNumber, { color: colors.foreground }]}>24h</Text>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>frequência</Text>
              </View>
            </View>

            <Text style={[styles.updated, { color: colors.muted }]}>Última atualização: {lastUpdated}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.opportunityCard,
              { backgroundColor: colors.surface, borderColor: item.featured ? colors.primary : colors.border },
            ]}
          >
            <View style={styles.cardTopLine}>
              <View style={[styles.kindPill, { backgroundColor: item.kind === "Concurso" ? `${colors.primary}18` : `${colors.warning}1A` }]}>
                <Text style={[styles.kindText, { color: item.kind === "Concurso" ? colors.primary : colors.warning }]}>{item.kind}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable onPress={(event) => { event.stopPropagation(); void toggleFavorite(item.id); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={favoriteIds.includes(item.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}>
                  <IconSymbol name="star.fill" size={20} color={favoriteIds.includes(item.id) ? colors.warning : colors.muted} />
                </Pressable>
                <Pressable onPress={(event) => { event.stopPropagation(); deleteOpportunity(item.id); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Excluir oportunidade">
                  <IconSymbol name="trash" size={20} color={colors.muted} />
                </Pressable>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </View>
            </View>
            <Pressable
              onPress={async () => {
                await markOpportunityAsViewed(item.id);
                if (item.sourceUrl) {
                  try {
                    await Linking.openURL(item.sourceUrl);
                  } catch {
                    Alert.alert("Não foi possível abrir o link", item.sourceUrl);
                  }
                } else {
                  Alert.alert(
                    item.title,
                    `${item.organization}
${item.city}

O link oficial ainda não está disponível para esta oportunidade.`
                  );
                }
              }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[styles.opportunityTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.organization, { color: colors.muted }]}>{item.organization}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <IconSymbol name="mappin.and.ellipse" size={15} color={colors.primary} />
                  <Text style={[styles.metaText, { color: colors.muted }]}>{item.city}</Text>
                </View>
                <View style={styles.metaItem}>
                  <IconSymbol name="calendar" size={15} color={colors.primary} />
                  <Text style={[styles.metaText, { color: colors.muted }]}>{item.deadline}</Text>
                </View>
              </View>
              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <Text style={[styles.sourceText, { color: colors.muted }]}>{item.source}</Text>
                <Text style={[styles.publishedText, { color: colors.primary }]}>{item.published}</Text>
              </View>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View style={[styles.footerNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="shield.checkered" size={22} color={colors.success} />
            <View style={styles.footerCopy}>
              <Text style={[styles.footerTitle, { color: colors.foreground }]}>Editais oficiais em primeiro lugar</Text>
              <Text style={[styles.footerBody, { color: colors.muted }]}>O app deve sempre levar vocês para a publicação original antes de qualquer candidatura.</Text>
            </View>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingTop: 18, paddingBottom: 32 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  greeting: { fontSize: 27, fontWeight: "800", marginTop: 5, letterSpacing: -0.7 },
  authorBlock: { alignItems: "flex-start", marginTop: 10 },
  authorPhotoSpace: { width: 62, height: 48, borderRadius: 13, borderWidth: 1, marginBottom: 5 },
  dedication: { fontSize: 13, fontWeight: "800", letterSpacing: 0.1 },
  liveDot: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", shadowColor: "#123", shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  heroCard: { borderRadius: 26, padding: 21, minHeight: 166, flexDirection: "row", overflow: "hidden", shadowColor: "#1D4ED8", shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  heroCopy: { flex: 1, paddingRight: 10 },
  heroKicker: { color: "#DBEAFE", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 10 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.5 },
  heroBody: { color: "#E8F1FF", fontSize: 13, lineHeight: 19, marginTop: 10 },
  heroBadge: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginTop: 3 },
  infoStrip: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 15, paddingHorizontal: 3 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 25, marginBottom: 13 },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  sectionSubtitle: { fontSize: 12, marginTop: 4 },
  refreshButton: { flexDirection: "row", gap: 5, alignItems: "center", paddingVertical: 6, paddingLeft: 8 },
  refreshText: { fontSize: 12, fontWeight: "800" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  filterText: { fontSize: 12, fontWeight: "700" },
  summaryRow: { flexDirection: "row", gap: 9, marginBottom: 14 },
  summaryCard: { flex: 1, borderRadius: 16, borderWidth: 1, minHeight: 69, paddingHorizontal: 11, paddingVertical: 11, justifyContent: "space-between" },
  summaryNumber: { fontSize: 18, fontWeight: "800" },
  summaryLabel: { fontSize: 10, fontWeight: "600" },
  updated: { fontSize: 11, marginBottom: 11 },
  opportunityCard: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12, shadowColor: "#0A3332", shadowOpacity: 0.05, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardTopLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  kindPill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  kindText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  opportunityTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  organization: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  metaRow: { gap: 7, marginTop: 14 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 12, flexShrink: 1 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, marginTop: 14, paddingTop: 12 },
  sourceText: { fontSize: 11, fontWeight: "600" },
  publishedText: { fontSize: 11, fontWeight: "800" },
  footerNote: { flexDirection: "row", gap: 10, borderRadius: 18, borderWidth: 1, padding: 15, marginTop: 4 },
  footerCopy: { flex: 1 },
  footerTitle: { fontSize: 13, fontWeight: "800" },
  footerBody: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
