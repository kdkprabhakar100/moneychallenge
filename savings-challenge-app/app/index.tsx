import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DashboardScreen from "../screens/DashboardScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

export default function Index() {
  const [token, setToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<"login" | "register">("login");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const savedToken = await AsyncStorage.getItem("token");
      if (savedToken) setToken(savedToken);
    } catch (error) {
      console.log("Check login error:", error);
    } finally {
      setCheckingAuth(false);
    }
  };

  // ── Auth splash ──
  if (checkingAuth) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#10e88a" />
      </View>
    );
  }

  // ── Logged in ──
  if (token) {
    return <DashboardScreen token={token} setToken={setToken} />;
  }

  // ── Register ──
  if (screen === "register") {
    return <RegisterScreen goToLogin={() => setScreen("login")} />;
  }

  // ── Login ──
  return (
    <LoginScreen
      setToken={setToken}
      goToRegister={() => setScreen("register")}
    />
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
  },
});