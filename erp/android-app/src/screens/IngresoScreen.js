import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api/client";

const SECCION_COLORS = {
  INCOMPLETO: "#f59e0b",
  OK: "#22c55e",
  SOLO_FALTA_REM: "#3b82f6",
  SOLO_FALTA_FAC: "#8b5cf6",
  SIN_NADA: "#64748b",
};

const SECCION_LABELS = {
  INCOMPLETO: "Incompleto",
  OK: "Completo",
  SOLO_FALTA_REM: "Falta Remito",
  SOLO_FALTA_FAC: "Falta Factura",
  SIN_NADA: "Sin docs",
};

function getSeccion(nota) {
  const hasFac = nota.facturas?.length > 0;
  const hasRem = nota.remitos?.length > 0;
  const totalFac = (nota.facturas || []).reduce((s, f) => s + (f.quantity || 0), 0);
  const totalRem = (nota.remitos || []).reduce((s, r) => s + (r.quantity || 0), 0);
  const np = nota.pedido_qty || 0;
  const dif = np > 0 && totalFac > 0 ? np - totalFac : 0;
  const totalDocs = (nota.facturas?.length || 0) + (nota.remitos?.length || 0);

  if (totalDocs === 0) return "SIN_NADA";
  const ok = hasFac && hasRem && dif === 0 && np > 0;
  if (ok) return "OK";
  if (totalDocs > 0 && dif !== 0) return "INCOMPLETO";
  if (hasFac && !hasRem) return "SOLO_FALTA_REM";
  if (hasRem && !hasFac) return "SOLO_FALTA_FAC";
  return "SIN_NADA";
}

function NotaCard({ nota, onPress }) {
  const sec = getSeccion(nota);
  const color = SECCION_COLORS[sec] || "#64748b";
  const totalFac = (nota.facturas || []).reduce((s, f) => s + (f.quantity || 0), 0);
  const totalRem = (nota.remitos || []).reduce((s, r) => s + (r.quantity || 0), 0);
  const dif = nota.pedido_qty ? nota.pedido_qty - totalFac : 0;

  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <Text style={styles.cardNumber} numberOfLines={1}>#{nota.number}</Text>
        <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{SECCION_LABELS[sec]}</Text>
        </View>
      </View>
      <Text style={styles.cardProvider} numberOfLines={1}>{nota.proveedor}</Text>
      <Text style={styles.cardLocal} numberOfLines={1}>{nota.local}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>📄 Ped: {nota.pedido_qty ?? "—"}</Text>
        <Text style={styles.cardMeta}>🧾 Fac: {totalFac}</Text>
        <Text style={styles.cardMeta}>📦 Rem: {totalRem}</Text>
        {dif !== 0 && <Text style={[styles.cardDif, { color: dif > 0 ? "#f59e0b" : "#22c55e" }]}>
          {dif > 0 ? `−${dif}u` : `+${Math.abs(dif)}u`}
        </Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function IngresoScreen({ navigation }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ingresos-all"],
    queryFn: () => api.get("/pedidos/vista-integrada/all"),
    staleTime: 60000,
  });

  const notas = data?.notas || [];

  const filtered = notas.filter((n) => {
    const matchSearch = !search || [n.number, n.proveedor, n.local].some(
      (v) => v?.toLowerCase().includes(search.toLowerCase())
    );
    const sec = getSeccion(n);
    const matchFilter = filter === "ALL" || sec === filter;
    return matchSearch && matchFilter;
  });

  const counts = notas.reduce((acc, n) => {
    const s = getSeccion(n);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <LinearGradient colors={["#020617", "#0f172a"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Ingresos</Text>
        <Text style={styles.subtitle}>{filtered.length} registros</Text>
      </View>

      {/* Filter chips */}
      <View style={styles.chips}>
        {[["ALL", "Todos", "#64748b"], ["INCOMPLETO", "Incompleto", "#f59e0b"], ["OK", "OK", "#22c55e"], ["SOLO_FALTA_REM", "Sin REM", "#3b82f6"]].map(([key, label, color]) => (
          <TouchableOpacity
            key={key}
            style={[styles.chip, filter === key && { backgroundColor: color + "33", borderColor: color }]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.chipText, filter === key && { color }]}>
              {label} {counts[key] ? `(${counts[key]})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por NP, proveedor, local..."
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color="#64748b" /></TouchableOpacity> : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => String(n.id)}
          renderItem={({ item }) => (
            <NotaCard nota={item} onPress={() => navigation.navigate("IngresoDetail", { nota: item })} />
          )}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sin resultados</Text>
            </View>
          }
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 10 },
  title: { color: "#f1f5f9", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 12, marginTop: 2 },
  chips: { flexDirection: "row", paddingHorizontal: 16, gap: 6, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "#1e293b", backgroundColor: "#0f172a" },
  chipText: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: "#1e293b", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  searchInput: { flex: 1, color: "#f1f5f9", fontSize: 13 },
  list: { padding: 12, paddingBottom: 80 },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    borderLeftWidth: 4,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardNumber: { color: "#f1f5f9", fontWeight: "800", fontSize: 14, fontFamily: "monospace", flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  cardProvider: { color: "#94a3b8", fontSize: 12, marginBottom: 2 },
  cardLocal: { color: "#64748b", fontSize: 11, marginBottom: 6 },
  cardFooter: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  cardMeta: { color: "#475569", fontSize: 11 },
  cardDif: { fontWeight: "800", fontSize: 11 },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: "#475569", fontSize: 14 },
});
