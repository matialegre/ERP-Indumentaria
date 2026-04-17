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
  PENDIENTE: "#f59e0b",
  PROCESADO: "#22c55e",
  PAGADO: "#3b82f6",
  SIN_RV: "#8b5cf6",
  COMPLETO: "#22c55e",
};

const SEMAFORO_COLORS = { VERDE: "#22c55e", AMARILLO: "#f59e0b", ROJO: "#ef4444" };

function PICard({ pi }) {
  const semColor = SEMAFORO_COLORS[pi.estado_semaforo] || "#64748b";
  const estColor = ESTADO_COLORS[pi.ingreso_status] || "#64748b";

  return (
    <View style={[styles.card, { borderLeftColor: semColor }]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardNum} numberOfLines={1}>#{pi.invoice_number || pi.number}</Text>
        <View style={[styles.badge, { backgroundColor: estColor + "22", borderColor: estColor }]}>
          <Text style={[styles.badgeText, { color: estColor }]}>{pi.ingreso_status || "—"}</Text>
        </View>
      </View>
      <Text style={styles.cardProvider} numberOfLines={1}>{pi.provider_name || pi.proveedor}</Text>
      <Text style={styles.cardLocal} numberOfLines={1}>{pi.local_name || pi.local}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>📦 {pi.total_units ?? "—"}u</Text>
        {pi.remito_venta_number
          ? <Text style={styles.rvText}>RV: {pi.remito_venta_number}</Text>
          : <Text style={styles.noRv}>Sin RV</Text>}
        <View style={[styles.semDot, { backgroundColor: semColor }]} />
        <Text style={[styles.semText, { color: semColor }]}>{pi.estado_semaforo || "—"}</Text>
      </View>
    </View>
  );
}

export default function RecepcionScreen() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => api.get("/purchase-invoices/?limit=500"),
    staleTime: 60000,
  });

  const items = data?.items || data?.purchase_invoices || [];

  const filtered = items.filter((pi) => {
    const matchSearch = !search || [pi.invoice_number, pi.number, pi.provider_name, pi.proveedor, pi.local_name, pi.local, pi.remito_venta_number].some(
      (v) => v?.toLowerCase?.().includes(search.toLowerCase())
    );
    const matchFilter =
      filter === "ALL" ||
      (filter === "SIN_RV" && !pi.remito_venta_number) ||
      (filter === "PENDIENTE" && pi.ingreso_status === "PENDIENTE") ||
      (filter === "COMPLETO" && pi.ingreso_status === "COMPLETO");
    return matchSearch && matchFilter;
  });

  const counts = {
    SIN_RV: items.filter((p) => !p.remito_venta_number).length,
    PENDIENTE: items.filter((p) => p.ingreso_status === "PENDIENTE").length,
    COMPLETO: items.filter((p) => p.ingreso_status === "COMPLETO").length,
  };

  return (
    <LinearGradient colors={["#020617", "#0f172a"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Recepción</Text>
        <Text style={styles.subtitle}>{filtered.length} facturas</Text>
      </View>

      <View style={styles.chips}>
        {[
          ["ALL", "Todos", "#64748b"],
          ["SIN_RV", `Sin RV (${counts.SIN_RV})`, "#8b5cf6"],
          ["PENDIENTE", `Pendiente (${counts.PENDIENTE})`, "#f59e0b"],
          ["COMPLETO", `Completo (${counts.COMPLETO})`, "#22c55e"],
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
          placeholder="Buscar por factura, proveedor, RV..."
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
          renderItem={({ item }) => <PICard pi={item} />}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Sin resultados</Text></View>}
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
  rvText: { color: "#22c55e", fontSize: 11, fontWeight: "700" },
  noRv: { color: "#8b5cf6", fontSize: 11, fontStyle: "italic" },
  semDot: { width: 6, height: 6, borderRadius: 3 },
  semText: { fontSize: 10, fontWeight: "600" },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: "#475569", fontSize: 14 },
});
