import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";

const { width } = Dimensions.get("window");

/* ─────────────────────────────────────────────
   ROBOT ANIMATION COMPONENT
   Pure Animated API — sin dependencias externas
───────────────────────────────────────────── */
function RobotAnimation({ isLoading, loginSuccess, loginFail }) {
  // Body bounce
  const bodyBounce = useRef(new Animated.Value(0)).current;
  // Eye blink
  const eyeLeft = useRef(new Animated.Value(1)).current;
  const eyeRight = useRef(new Animated.Value(1)).current;
  // Antenna bounce
  const antennaBounce = useRef(new Animated.Value(0)).current;
  // Left arm wave
  const armLeft = useRef(new Animated.Value(0)).current;
  // Right arm wave
  const armRight = useRef(new Animated.Value(0)).current;
  // Mouth width (smile/sad)
  const mouthWidth = useRef(new Animated.Value(24)).current;
  const mouthColor = useRef(new Animated.Value(0)).current;
  // Glow when loading
  const glowOpacity = useRef(new Animated.Value(0)).current;
  // Head tilt when success
  const headTilt = useRef(new Animated.Value(0)).current;
  // Shake when fail
  const shakeX = useRef(new Animated.Value(0)).current;

  // Idle loop
  useEffect(() => {
    // Body idle bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(bodyBounce, { toValue: -6, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bodyBounce, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Antenna bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(antennaBounce, { toValue: -4, duration: 600, useNativeDriver: true }),
        Animated.timing(antennaBounce, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    // Eye blinking
    const blinkEye = (eye) =>
      Animated.sequence([
        Animated.delay(Math.random() * 3000 + 1000),
        Animated.timing(eye, { toValue: 0.05, duration: 80, useNativeDriver: true }),
        Animated.timing(eye, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]);

    const blinkLoop = () => {
      Animated.parallel([blinkEye(eyeLeft), blinkEye(eyeRight)]).start(blinkLoop);
    };
    blinkLoop();

    // Arm wave idle (slow)
    Animated.loop(
      Animated.sequence([
        Animated.timing(armLeft, { toValue: 8, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(armLeft, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(armRight, { toValue: -8, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(armRight, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Loading animation
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.8, duration: 400, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.2, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      glowOpacity.setValue(0);
    }
  }, [isLoading]);

  // Success animation
  useEffect(() => {
    if (loginSuccess) {
      Animated.sequence([
        Animated.timing(headTilt, { toValue: 15, duration: 150, useNativeDriver: true }),
        Animated.timing(headTilt, { toValue: -15, duration: 150, useNativeDriver: true }),
        Animated.timing(headTilt, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
      Animated.timing(mouthWidth, { toValue: 36, duration: 300, useNativeDriver: false }).start();
    }
  }, [loginSuccess]);

  // Fail animation — shake
  useEffect(() => {
    if (loginFail) {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -12, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 12, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
      Animated.timing(mouthWidth, { toValue: 14, duration: 300, useNativeDriver: false }).start();
      setTimeout(() => Animated.timing(mouthWidth, { toValue: 24, duration: 400, useNativeDriver: false }).start(), 1500);
    }
  }, [loginFail]);

  const eyeColor = isLoading ? "#60a5fa" : loginFail ? "#ef4444" : "#22d3ee";

  return (
    <Animated.View style={[styles.robotContainer, { transform: [{ translateX: shakeX }, { translateY: bodyBounce }] }]}>
      {/* Glow ring */}
      <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />

      {/* Antenna */}
      <Animated.View style={[styles.antennaPole, { transform: [{ translateY: antennaBounce }] }]}>
        <View style={[styles.antennaBall, isLoading && styles.antennaBallActive]} />
        <View style={styles.antennaStem} />
      </Animated.View>

      {/* Head */}
      <Animated.View style={[styles.robotHead, { transform: [{ rotate: headTilt.interpolate({ inputRange: [-15, 15], outputRange: ["-15deg", "15deg"] }) }] }]}>
        {/* Screen/visor */}
        <View style={styles.visor}>
          {/* Eyes */}
          <Animated.View style={[styles.eye, { backgroundColor: eyeColor, transform: [{ scaleY: eyeLeft }] }]} />
          <Animated.View style={[styles.eye, { backgroundColor: eyeColor, transform: [{ scaleY: eyeRight }] }]} />
        </View>
        {/* Mouth */}
        <View style={styles.mouthArea}>
          <Animated.View
            style={[
              styles.mouth,
              { width: mouthWidth, backgroundColor: loginFail ? "#ef4444" : loginSuccess ? "#22c55e" : "#94a3b8" },
            ]}
          />
        </View>
        {/* Side bolts */}
        <View style={[styles.bolt, styles.boltLeft]} />
        <View style={[styles.bolt, styles.boltRight]} />
      </Animated.View>

      {/* Neck */}
      <View style={styles.neck} />

      {/* Body */}
      <View style={styles.robotBody}>
        {/* Chest panel */}
        <View style={styles.chestPanel}>
          <View style={[styles.led, { backgroundColor: isLoading ? "#60a5fa" : loginSuccess ? "#22c55e" : "#1e40af" }]} />
          <View style={[styles.led, { backgroundColor: isLoading ? "#818cf8" : loginFail ? "#ef4444" : "#1e40af" }]} />
          <View style={[styles.led, { backgroundColor: isLoading ? "#a78bfa" : "#1e40af" }]} />
        </View>
        {/* Belly screen */}
        <View style={styles.bellyScreen}>
          <Text style={styles.bellyText}>{isLoading ? "..." : loginSuccess ? "OK!" : loginFail ? "ERR" : "ERP"}</Text>
        </View>
        {/* Vents */}
        <View style={styles.vents}>
          {[0, 1, 2].map((i) => <View key={i} style={styles.vent} />)}
        </View>
      </View>

      {/* Arms */}
      <Animated.View style={[styles.armLeft, { transform: [{ translateY: armLeft }] }]}>
        <View style={styles.armSegment} />
        <View style={styles.hand} />
      </Animated.View>
      <Animated.View style={[styles.armRight, { transform: [{ translateY: armRight }] }]}>
        <View style={styles.armSegment} />
        <View style={styles.hand} />
      </Animated.View>

      {/* Legs */}
      <View style={styles.legsContainer}>
        <View style={styles.leg}>
          <View style={styles.legSegment} />
          <View style={styles.foot} />
        </View>
        <View style={styles.leg}>
          <View style={styles.legSegment} />
          <View style={styles.foot} />
        </View>
      </View>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────
   LOGIN SCREEN
───────────────────────────────────────────── */
export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fail, setFail] = useState(false);

  // Form slide up on mount
  const formSlide = useRef(new Animated.Value(60)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(formSlide, { toValue: 0, duration: 700, delay: 400, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(formOpacity, { toValue: 1, duration: 600, delay: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Ingresá tu usuario y contraseña");
      setFail(true);
      setTimeout(() => setFail(false), 100);
      return;
    }
    setLoading(true);
    setError("");
    setFail(false);
    try {
      await login(username.trim(), password);
      setSuccess(true);
    } catch (e) {
      setLoading(false);
      setFail(true);
      setError(e.message || "Error de autenticación");
      setTimeout(() => setFail(false), 100);
    }
  };

  return (
    <LinearGradient colors={["#020617", "#0f172a", "#1e1b4b"]} style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <Text style={styles.appTitle}>MUNDO OUTDOOR</Text>
          <Text style={styles.appSubtitle}>Sistema ERP</Text>

          {/* Robot */}
          <RobotAnimation isLoading={loading} loginSuccess={success} loginFail={fail} />

          {/* Form */}
          <Animated.View style={[styles.form, { transform: [{ translateY: formSlide }], opacity: formOpacity }]}>
            <Text style={styles.formTitle}>Iniciar sesión</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Usuario</Text>
              <TextInput
                style={styles.input}
                placeholder="tu usuario"
                placeholderTextColor="#475569"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#475569"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.loginBtnText}>Ingresar →</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footerNote}>ERP Mundo Outdoor v1.0</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center", paddingTop: 50, paddingBottom: 30 },

  appTitle: { color: "#f1f5f9", fontSize: 22, fontWeight: "800", letterSpacing: 4, marginBottom: 2 },
  appSubtitle: { color: "#64748b", fontSize: 12, letterSpacing: 2, marginBottom: 20 },

  // Robot
  robotContainer: { alignItems: "center", marginBottom: 12, position: "relative" },
  glowRing: {
    position: "absolute",
    top: 10,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#3b82f6",
    zIndex: -1,
  },

  antennaPole: { alignItems: "center", marginBottom: 0 },
  antennaBall: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#60a5fa", marginBottom: 0 },
  antennaBallActive: { backgroundColor: "#f59e0b", shadowColor: "#f59e0b", shadowOpacity: 1, shadowRadius: 8 },
  antennaStem: { width: 3, height: 14, backgroundColor: "#334155" },

  robotHead: {
    width: 80,
    height: 70,
    backgroundColor: "#1e3a5f",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2563eb",
    position: "relative",
  },
  visor: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#0a1628",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 6,
  },
  eye: { width: 14, height: 14, borderRadius: 7 },
  mouthArea: { alignItems: "center" },
  mouth: { height: 3, borderRadius: 2 },
  bolt: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: "#334155", top: "50%", marginTop: -4 },
  boltLeft: { left: -4 },
  boltRight: { right: -4 },

  neck: { width: 16, height: 8, backgroundColor: "#1e293b" },

  robotBody: {
    width: 90,
    height: 80,
    backgroundColor: "#1e3a5f",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2563eb",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  chestPanel: { flexDirection: "row", gap: 6 },
  led: { width: 8, height: 8, borderRadius: 4 },
  bellyScreen: {
    backgroundColor: "#0a1628",
    width: 44,
    height: 22,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  bellyText: { color: "#22d3ee", fontSize: 10, fontWeight: "800", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  vents: { flexDirection: "row", gap: 4 },
  vent: { width: 14, height: 3, backgroundColor: "#0a1628", borderRadius: 2 },

  armLeft: { position: "absolute", left: width / 2 - 78, top: 115, alignItems: "center" },
  armRight: { position: "absolute", right: width / 2 - 78, top: 115, alignItems: "center" },
  armSegment: { width: 14, height: 36, backgroundColor: "#1e3a5f", borderRadius: 7, borderWidth: 1.5, borderColor: "#2563eb" },
  hand: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#1e3a5f", borderWidth: 1.5, borderColor: "#2563eb" },

  legsContainer: { flexDirection: "row", gap: 10, marginTop: 0 },
  leg: { alignItems: "center" },
  legSegment: { width: 16, height: 30, backgroundColor: "#1e3a5f", borderRadius: 6, borderWidth: 1.5, borderColor: "#2563eb" },
  foot: { width: 22, height: 12, borderRadius: 6, backgroundColor: "#1e3a5f", borderWidth: 1.5, borderColor: "#2563eb" },

  // Form
  form: {
    width: width - 48,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  formTitle: { color: "#f1f5f9", fontSize: 18, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  errorBox: { backgroundColor: "#450a0a", borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#991b1b" },
  errorText: { color: "#fca5a5", fontSize: 12, textAlign: "center" },
  inputGroup: { marginBottom: 14 },
  label: { color: "#94a3b8", fontSize: 12, fontWeight: "600", marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: "#1e293b",
    color: "#f1f5f9",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#334155",
  },
  loginBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
    shadowColor: "#2563eb",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  loginBtnDisabled: { backgroundColor: "#1d4ed8", opacity: 0.7 },
  loginBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 1 },
  footerNote: { color: "#334155", fontSize: 10, textAlign: "center", marginTop: 16 },
});
