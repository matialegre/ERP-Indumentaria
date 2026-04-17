import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";

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

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Querés cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sí, salir", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <LinearGradient colors={["#020617", "#0f172a"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.username || "U")[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.full_name || user?.username}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{ROLE_LABEL[user?.role] || user?.role}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          {[
            { icon: "person-outline", label: "Usuario", value: user?.username },
            { icon: "mail-outline", label: "Email", value: user?.email || "—" },
            { icon: "business-outline", label: "Empresa", value: user?.company_name || "—" },
            { icon: "location-outline", label: "Local", value: user?.local_name || "—" },
          ].map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <Ionicons name={row.icon} size={16} color="#64748b" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value || "—"}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Version */}
        <View style={styles.versionCard}>
          <Text style={styles.versionText}>ERP Mundo Outdoor</Text>
          <Text style={styles.versionNum}>Versión 1.0.0 · Android</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 40 },
  avatarSection: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#1e40af", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { color: "#93c5fd", fontWeight: "800", fontSize: 32 },
  name: { color: "#f1f5f9", fontSize: 20, fontWeight: "700", textAlign: "center" },
  roleBadge: { marginTop: 6, backgroundColor: "#1e293b", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: "#64748b", fontSize: 12, fontWeight: "600" },

  infoCard: { backgroundColor: "#0f172a", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#1e293b", gap: 14 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoLabel: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  infoValue: { color: "#f1f5f9", fontSize: 14, marginTop: 2 },

  versionCard: { backgroundColor: "#0f172a", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#1e293b", alignItems: "center" },
  versionText: { color: "#475569", fontSize: 12, fontWeight: "600" },
  versionNum: { color: "#334155", fontSize: 10, marginTop: 2 },

  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", backgroundColor: "#450a0a", borderWidth: 1, borderColor: "#991b1b", borderRadius: 12, padding: 14 },
  logoutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
});
