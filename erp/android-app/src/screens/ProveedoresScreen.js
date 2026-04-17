import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api/client";

function ProvCard({ prov }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(prov.name || "P")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={2}>{prov.name}</Text>
          {prov.cuit && <Text style={styles.cardCuit}>CUIT: {prov.cuit}</Text>}
        </View>
      </View>
      <View style={styles.cardFooter}>
        {prov.email && (
          <View style={styles.metaRow}>
            <Ionicons name="mail-outline" size={12} color="#64748b" />
            <Text style={styles.metaText} numberOfLines={1}>{prov.email}</Text>
          </View>
        )}
        {prov.phone && (
          <View style={styles.metaRow}>
            <Ionicons name="call-outline" size={12} color="#64748b" />
            <Text style={styles.metaText}>{prov.phone}</Text>
          </View>
        )}
        {prov.city && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color="#64748b" />
            <Text style={styles.metaText}>{prov.city}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function ProveedoresScreen() {
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["proveedores"],
    queryFn: () => api.get("/providers/"),
    staleTime: 300000,
  });

  const items = Array.isArray(data) ? data : (data?.providers || data?.items || []);
  const filtered = items.filter((p) =>
    !search ||
    [p.name, p.cuit, p.email, p.city].some((v) => v?.toLowerCase?.().includes(search.toLowerCase()))
  );

  return (
    <LinearGradient colors={["#020617", "#0f172a"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Proveedores</Text>
        <Text style={styles.subtitle}>{filtered.length} registros</Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar proveedor, CUIT, ciudad..."
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
          renderItem={({ item }) => <ProvCard prov={item} />}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Sin proveedores</Text></View>}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 10 },
  title: { color: "#f1f5f9", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 12, marginTop: 2 },
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: "#1e293b", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8, gap: 6 },
  searchInput: { flex: 1, color: "#f1f5f9", fontSize: 13 },
  list: { padding: 12, paddingBottom: 80 },
  card: { backgroundColor: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#1e293b" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1e40af", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#93c5fd", fontWeight: "800", fontSize: 16 },
  cardName: { color: "#f1f5f9", fontWeight: "700", fontSize: 14, flex: 1 },
  cardCuit: { color: "#64748b", fontSize: 11, marginTop: 2 },
  cardFooter: { gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: "#64748b", fontSize: 11, flex: 1 },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: "#475569", fontSize: 14 },
});
