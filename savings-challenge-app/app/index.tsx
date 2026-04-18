import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DashboardScreen from "../screens/DashboardScreen";

// FIX: Use localhost instead of hardcoded network IP
const API_URL = "http://localhost:5000";

export default function Index() {
  const [token, setToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<"login" | "register">("login");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Register state
  const [name, setName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  // Check for saved token on app start
  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const savedToken = await AsyncStorage.getItem("token");
      if (savedToken) {
        setToken(savedToken);
      }
    } catch (error) {
      console.log("Check login error:", error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const loginUser = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log("Login response:", data);

      if (!response.ok) {
        Alert.alert("Login Failed", data.message || "Invalid credentials");
        return;
      }

      await AsyncStorage.setItem("token", data.token);
      setToken(data.token);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.log("Login error:", error);
      Alert.alert("Error", "Could not connect to server. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async () => {
    if (!name || !registerEmail || !registerPassword) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      setRegisterLoading(true);

      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: registerEmail,
          password: registerPassword,
        }),
      });

      const data = await response.json();
      console.log("Register response:", data);

      if (!response.ok) {
        Alert.alert("Registration Failed", data.message || "Could not register");
        return;
      }

      Alert.alert("Success", "Account created! Please login.");
      setName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setScreen("login");
    } catch (error) {
      console.log("Register error:", error);
      Alert.alert("Error", "Could not connect to server. Is the server running?");
    } finally {
      setRegisterLoading(false);
    }
  };

  // Show spinner while checking saved auth
  if (checkingAuth) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // If logged in, show the full dashboard
  if (token) {
    return <DashboardScreen token={token} setToken={setToken} />;
  }

  // Register Screen
  if (screen === "register") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Money Challenge App</Text>
        <Text style={styles.subtitle}>Create Account</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full Name"
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          value={registerEmail}
          onChangeText={setRegisterEmail}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          value={registerPassword}
          onChangeText={setRegisterPassword}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, registerLoading && styles.disabledButton]}
          onPress={registerUser}
          disabled={registerLoading}
        >
          <Text style={styles.buttonText}>
            {registerLoading ? "Registering..." : "Register"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setScreen("login")}>
          <Text style={styles.linkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Login Screen
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Money Challenge App</Text>
      <Text style={styles.subtitle}>Welcome back 👋</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#9ca3af"
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.disabledButton]}
        onPress={loginUser}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "Login"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setScreen("register")}>
        <Text style={styles.linkText}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fb",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#111827",
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    color: "#6b7280",
    marginBottom: 32,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
    color: "#111",
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 4,
  },
  disabledButton: {
    backgroundColor: "#93c5fd",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  linkText: {
    textAlign: "center",
    marginTop: 18,
    color: "#2563eb",
    fontWeight: "600",
    fontSize: 14,
  },
});