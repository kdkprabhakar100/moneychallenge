import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator } from "react-native";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import DashboardScreen from "./screens/DashboardScreen";

export default function App() {
  const [token, setToken] = useState(null);
  const [screen, setScreen] = useState("login");
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (token) {
    return <DashboardScreen token={token} setToken={setToken} />;
  }

  if (screen === "register") {
    return <RegisterScreen goToLogin={() => setScreen("login")} />;
  }

  return (
    <LoginScreen
      setToken={setToken}
      goToRegister={() => setScreen("register")}
    />
  );
}