import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";


const API_URL = process.env.EXPO_PUBLIC_API_URL;


export default function LoginScreen({ setToken, goToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { width } = useWindowDimensions();

  const isLargeScreen = width >= 900;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Login Failed", data.message || "Something went wrong");
        return;
      }

      await AsyncStorage.setItem("token", data.token);
      setToken(data.token);
    } catch (error) {
      console.log("Login error:", error);
      Alert.alert("Error", "Could not connect to server. Is it running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          isLargeScreen && styles.scrollContainerLarge,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentWrap, isLargeScreen && styles.contentWrapLarge]}>

          {/* ── Brand Header ── */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>PK</Text>
              </View>
              <View>
                <Text style={styles.brandTitle}>Money Challenge</Text>
                <Text style={styles.brandSubtitle}>SAVINGS TRACKER</Text>
              </View>
            </View>
          </View>

          {/* ── Auth Card ── */}
          <View style={[styles.authCard, isLargeScreen && styles.authCardLarge]}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Login to continue your journey</Text>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={[styles.input, focusedField === "email" && styles.inputFocused]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@gmail.com"
                placeholderTextColor="#334155"
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={[styles.input, focusedField === "password" && styles.inputFocused]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Enter your password"
                placeholderTextColor="#334155"
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#03130d" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register Link */}
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={goToRegister}
              activeOpacity={0.75}
            >
              <Text style={styles.outlineButtonText}>
                Create an account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom note */}
          <Text style={styles.bottomNote}>Your savings data is stored securely 🔒</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#020617",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  scrollContainerLarge: {
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  contentWrap: {
    width: "100%",
    alignSelf: "center",
  },
  contentWrapLarge: {
    maxWidth: 520,
  },

  // ── Brand ─────────────────────────────────
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#10e88a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10e88a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#03130d",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    color: "#475569",
    letterSpacing: 1.5,
    marginTop: 2,
    fontWeight: "700",
  },

  // ── Card ──────────────────────────────────
  authCard: {
    backgroundColor: "#111827",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1e293b",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
    marginBottom: 20,
  },
  authCardLarge: {
    paddingHorizontal: 32,
    paddingVertical: 30,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 28,
  },

  // ── Fields ────────────────────────────────
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1f2937",
    borderWidth: 1.5,
    borderColor: "#334155",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
  inputFocused: {
    borderColor: "#10e88a",
    backgroundColor: "#0d2b1e",
  },

  // ── Buttons ───────────────────────────────
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#10e88a",
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: "#10e88a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  disabledButton: {
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: "#03130d",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  outlineButton: {
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  outlineButtonText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Divider ───────────────────────────────
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1e293b",
  },
  dividerLabel: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
  },

  // ── Bottom note ───────────────────────────
  bottomNote: {
    textAlign: "center",
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
});