import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const SEMAFORO_COLORS = { VERDE: "#22c55e", AMARILLO: "#f59e0b", ROJO: "#ef4444" };

function DocRow({ doc, type }) {
  const isFac = type === "FAC";
  const color = isFac ? "#3b82f6" : "#f97316";
  const rv = !isFac && doc.remito_venta_number;
  return (
    <View style={[styles.docRow, { borderLeftColor: color }]}>
      <View style={[styles.docBadge, { backgroundColor: color + "22", borderColor: color }]}>
        <Text style={[styles.docBadgeText, { color }]}>{type}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docNumber} numberOfLines={1}>{doc.number}</Text>
        <Text style={styles.docMeta}>{doc.quantity}u · {doc.date || "—"}</Text>
        {rv ? <Text style={styles.rvBadge}>RV: {rv}</Text> : null}
      </View>
      <View style={[styles.statusDot, {
        backgroundColor:
          doc.status === "CONFIRMADO" ? "#22c55e" :
          doc.status === "ANULADO" ? "#ef4444" : "#f59e0b"
      }]} />
    </View>
  );
}

export default function IngresoDetailScreen({ route }) {
  const { nota } = route.params;
  const totalFac = (nota.facturas || []).reduce((s, f) => s + (f.quantity || 0), 0);
  const totalRem = (nota.remitos || []).reduce((s, r) => s + (r.quantity || 0), 0);
  const dif = (nota.pedido_qty || 0) - totalFac;

  return (
    <LinearGradient colors={["#020617", "#0f172a"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.topCard}>
          <Text style={styles.notaNumber}>#{nota.number}</Text>
          <Text style={styles.proveedor}>{nota.proveedor}</Text>
          <Text style={styles.local}>{nota.local}</Text>
          {nota.fecha && <Text style={styles.fecha}>{nota.fecha}</Text>}
        </View>

        {/* Quantities */}
        <View style={styles.qtyRow}>
          {[
            { label: "Pedido", value: nota.pedido_qty ?? "—", color: "#64748b" },
            { label: "Facturado", value: totalFac, color: "#3b82f6" },
            { label: "Remitido", value: totalRem, color: "#f97316" },
            { label: "Diferencia", value: dif !== 0 ? (dif > 0 ? `-${dif}u` : `+${Math.abs(dif)}u`) : "✓", color: dif > 0 ? "#f59e0b" : dif < 0 ? "#22c55e" : "#22c55e" },
          ].map((q) => (
            <View key={q.label} style={styles.qtyCard}>
              <Text style={[styles.qtyValue, { color: q.color }]}>{q.value}</Text>
              <Text style={styles.qtyLabel}>{q.label}</Text>
            </View>
          ))}
        </View>

        {/* Documentos */}
        {(nota.facturas?.length > 0 || nota.remitos?.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documentos</Text>
            <View style={styles.docsGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.colHeader}>FACTURAS</Text>
                {nota.facturas?.length > 0
                  ? nota.facturas.map((f) => <DocRow key={f.id} doc={f} type="FAC" />)
                  : <Text style={styles.noDoc}>—</Text>}
              </View>
              <View style={styles.divider} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.colHeader, { color: "#f97316" }]}>REMITOS</Text>
                {nota.remitos?.length > 0
                  ? nota.remitos.map((r) => <DocRow key={r.id} doc={r} type="REM" />)
                  : <Text style={styles.noDoc}>—</Text>}
              </View>
            </View>
          </View>
        )}

        {/* Notes */}
        {nota.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <Text style={styles.notes}>{nota.notes}</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  topCard: { backgroundColor: "#0f172a", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#1e293b" },
  notaNumber: { color: "#f1f5f9", fontWeight: "800", fontSize: 18, fontFamily: "monospace" },
  proveedor: { color: "#94a3b8", fontSize: 14, marginTop: 4 },
  local: { color: "#64748b", fontSize: 12, marginTop: 2 },
  fecha: { color: "#475569", fontSize: 11, marginTop: 4 },

  qtyRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  qtyCard: { flex: 1, backgroundColor: "#0f172a", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#1e293b" },
  qtyValue: { fontSize: 16, fontWeight: "800" },
  qtyLabel: { color: "#475569", fontSize: 10, marginTop: 2 },

  section: { backgroundColor: "#0f172a", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#1e293b" },
  sectionTitle: { color: "#64748b", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 10 },

  docsGrid: { flexDirection: "row", gap: 0 },
  divider: { width: 1, backgroundColor: "#1e293b", marginHorizontal: 6 },
  colHeader: { color: "#3b82f6", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  noDoc: { color: "#334155", fontSize: 12, textAlign: "center", paddingTop: 8 },

  docRow: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 6, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  docBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  docBadgeText: { fontSize: 9, fontWeight: "800" },
  docNumber: { color: "#f1f5f9", fontSize: 11, fontWeight: "700", fontFamily: "monospace" },
  docMeta: { color: "#64748b", fontSize: 10 },
  rvBadge: { color: "#22c55e", fontSize: 9, fontWeight: "700" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  notes: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
});
