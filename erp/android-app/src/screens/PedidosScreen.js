import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api/client";

const ESTADO_COLORS = {
  BORRADOR: "#f59e0b",
  ENVIADO: "#3b82f6",
  RECIBIDO: "#22c55e",
  CANCELADO: "#ef4444",
};

function POCard({ po }) {
  const color = ESTADO_COLORS[po.estado] || "#64748b";
  const totalItems = po.items?.reduce((s, i) => s + (i.quantity || 0), 0) ?? po.total_items ?? 0;

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardNum} numberOfLines={1}>#{po.number || po.id}</Text>
        <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{po.estado || "—"}</Text>
        </View>
      </View>
      <Text style={styles.cardProvider} numberOfLines={1}>{po.provider?.name || po.proveedor || "—"}</Text>
      {po.local && <Text style={styles.cardLocal} numberOfLines={1}>{po.local}</Text>}
      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>📦 {totalItems}u</Text>
        {po.fecha && <Text style={styles.metaText}>📅 {po.fecha}</Text>}
        {po.observations && <Text style={styles.obsText} numberOfLines={1}>{po.observations}</Text>}
      </View>
    </View>
  );
}

export default function PedidosScreen() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => api.get("/purchase-orders/?limit=300"),
    staleTime: 60000,
  });

  const items = data?.items || data?.purchase_orders || [];

  const filtered = items.filter((po) => {
    const matchSearch = !search || [po.number, String(po.id), po.provider?.name, po.proveedor, po.observations].some(
      (v) => v?.toLowerCase?.().includes(search.toLowerCase())
    );
    const matchFilter = filter === "ALL" || po.estado === filter;
    return matchSearch && matchFilter;
  });

  const counts = items.reduce((acc, p) => { acc[p.estado] = (acc[p.estado] || 0) + 1; return acc; }, {});

  return (
    <LinearGradient colors={["#020617", "#0f172a"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Pedidos / Compras</Text>
        <Text style={styles.subtitle}>{filtered.length} pedidos</Text>
      </View>

      <View style={styles.chips}>
        {[
          ["ALL", "Todos", "#64748b"],
          ["BORRADOR", `Borrador (${counts.BORRADOR || 0})`, "#f59e0b"],
          ["ENVIADO", `Enviado (${counts.ENVIADO || 0})`, "#3b82f6"],
          ["RECIBIDO", `Recibido (${counts.RECIBIDO || 0})`, "#22c55e"],
        ].map(([key, label, color]) => (
          <TouchableOpacity
            key={key}
            style={[styles.chip, filter === key && { backgroundColor: color + "33", borderColor: color }]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.chipText, filter === key && { color }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar pedido, proveedor..."
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => <POCard po={item} />}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Sin pedidos</Text></View>}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 10 },
  title: { color: "#f1f5f9", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 12, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 6, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "#1e293b", backgroundColor: "#0f172a" },
  chipText: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: "#1e293b", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8, gap: 6 },
  searchInput: { flex: 1, color: "#f1f5f9", fontSize: 13 },
  list: { padding: 12, paddingBottom: 80 },
  card: { backgroundColor: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#1e293b", borderLeftWidth: 4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardNum: { color: "#f1f5f9", fontWeight: "800", fontSize: 14, fontFamily: "monospace", flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  cardProvider: { color: "#94a3b8", fontSize: 12, marginBottom: 2 },
  cardLocal: { color: "#64748b", fontSize: 11, marginBottom: 6 },
  cardFooter: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  metaText: { color: "#475569", fontSize: 11 },
  obsText: { color: "#334155", fontSize: 10, flex: 1, fontStyle: "italic" },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: "#475569", fontSize: 14 },
});
