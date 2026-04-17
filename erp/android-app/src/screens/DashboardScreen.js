import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const { width } = Dimensions.get("window");

const ROLE_LABEL = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Administrador",
  COMPRAS: "Compras",
  ADMINISTRACION: "Administración",
  GESTION_PAGOS: "Gestión Pagos",
  LOCAL: "Local",
  VENDEDOR: "Vendedor",
  DEPOSITO: "Depósito",
};

function StatCard({ icon, label, value, color, loading }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={color} style={{ alignSelf: "flex-start", marginTop: 2 }} />
        ) : (
          <Text style={[styles.statValue, { color }]}>{value ?? "—"}</Text>
        )}
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();

  const { data: systemInfo, isLoading: sysLoading } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => api.get("/system/health"),
    refetchInterval: 30000,
  });

  const { data: piData, isLoading: piLoading } = useQuery({
    queryKey: ["dashboard-pi"],
    queryFn: () => api.get("/purchase-invoices/?limit=1"),
    staleTime: 60000,
  });

  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ["dashboard-po"],
    queryFn: () => api.get("/purchase-orders/?limit=1"),
    staleTime: 60000,
  });

  return (
    <LinearGradient colors={["#020617", "#0f172a"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hola, {user?.full_name?.split(" ")[0] || user?.username} 👋</Text>
            <Text style={styles.role}>{ROLE_LABEL[user?.role] || user?.role}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.avatarBtn}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.username || "U")[0].toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* System status */}
        <View style={styles.sectionHeader}>
          <Ionicons name="pulse-outline" size={16} color="#64748b" />
          <Text style={styles.sectionTitle}>Estado del sistema</Text>
          <View style={[styles.statusDot, { backgroundColor: sysLoading ? "#f59e0b" : systemInfo ? "#22c55e" : "#ef4444" }]} />
        </View>

        {/* Stats */}
        <StatCard icon="document-text-outline" label="Facturas proveedor" value={piData?.total ?? "—"} color="#3b82f6" loading={piLoading} />
        <StatCard icon="cart-outline" label="Órdenes de compra" value={poData?.total ?? "—"} color="#8b5cf6" loading={poLoading} />
        <StatCard icon="server-outline" label="Backend" value={systemInfo ? "🟢 Online" : "⚫ Offline"} color={systemInfo ? "#22c55e" : "#64748b"} loading={sysLoading} />

        {/* Quick actions */}
        <Text style={styles.quickTitle}>Acceso rápido</Text>
        <View style={styles.quickGrid}>
          {[
            { label: "Ingresos", icon: "archive-outline", tab: "Ingresos", color: "#3b82f6" },
            { label: "Recepción", icon: "checkmark-circle-outline", tab: "Recepción", color: "#22c55e" },
            { label: "Pedidos", icon: "cart-outline", tab: "Pedidos", color: "#8b5cf6" },
            { label: "Proveedores", icon: "people-outline", tab: "Proveedores", color: "#f59e0b" },
          ].map((item) => (
            <TouchableOpacity
              key={item.tab}
              style={[styles.quickCard, { borderColor: item.color + "44" }]}
              onPress={() => navigation.navigate(item.tab)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={28} color={item.color} />
              <Text style={[styles.quickLabel, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={16} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 30 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  greeting: { color: "#f1f5f9", fontSize: 22, fontWeight: "700" },
  role: { color: "#64748b", fontSize: 12, marginTop: 2 },
  avatarBtn: {},
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2563eb", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { color: "#64748b", fontSize: 13, fontWeight: "600", flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  statCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
    borderLeftWidth: 3,
  },
  statIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  statLabel: { color: "#64748b", fontSize: 12, fontWeight: "500" },
  statValue: { fontSize: 20, fontWeight: "800", marginTop: 2 },

  quickTitle: { color: "#94a3b8", fontSize: 13, fontWeight: "600", marginTop: 16, marginBottom: 10 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: {
    width: (width - 50) / 2,
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  quickLabel: { fontSize: 12, fontWeight: "700" },

  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 30, padding: 12 },
  logoutText: { color: "#ef4444", fontSize: 14, fontWeight: "600" },
});
