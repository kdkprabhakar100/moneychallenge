import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://192.168.18.189:5000";

export default function DashboardScreen({ token, setToken }) {
  const [user, setUser] = useState(null);
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("");
  const [plan, setPlan] = useState([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      setLoadingUser(true);

      const response = await fetch(`${API_URL}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log("Me response:", data);

      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to load user");
        return;
      }

      setUser(data);
    } catch (error) {
      console.log("Fetch user error:", error);
      Alert.alert("Error", "Could not fetch user data");
    } finally {
      setLoadingUser(false);
    }
  };

  const createChallenge = async () => {
    if (!target || !days) {
      Alert.alert("Error", "Please enter target amount and number of days");
      return;
    }

    if (Number(target) <= 0 || Number(days) <= 0) {
      Alert.alert("Error", "Target amount and days must be greater than 0");
      return;
    }

    try {
      setCreatingChallenge(true);

      const response = await fetch(`${API_URL}/create-challenge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetAmount: Number(target),
          days: Number(days),
        }),
      });

      const data = await response.json();
      console.log("Challenge response:", data);

      if (!response.ok) {
        Alert.alert("Error", data.error || data.message || "Failed to create challenge");
        return;
      }

      setPlan(data.plan || []);
      Alert.alert("Success", "Challenge created successfully");
      setTarget("");
      setDays("");
    } catch (error) {
      console.log("Create challenge error:", error);
      Alert.alert("Error", "Could not create challenge");
    } finally {
      setCreatingChallenge(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      setToken(null);
    } catch (error) {
      console.log("Logout error:", error);
      Alert.alert("Error", "Could not logout");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>User Dashboard</Text>

      {loadingUser ? (
        <Text style={styles.loadingText}>Loading user...</Text>
      ) : user ? (
        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome, {user.name}</Text>
          <Text style={styles.info}>Email: {user.email}</Text>
          <Text style={styles.info}>User ID: {user.id}</Text>
        </View>
      ) : (
        <Text style={styles.loadingText}>Could not load user</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create Challenge</Text>

        <TextInput
          style={styles.input}
          placeholder="Target Amount"
          value={target}
          onChangeText={setTarget}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder="Number of Days"
          value={days}
          onChangeText={setDays}
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.button} onPress={createChallenge}>
          <Text style={styles.buttonText}>
            {creatingChallenge ? "Creating..." : "Create Challenge"}
          </Text>
        </TouchableOpacity>
      </View>

      {plan.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Generated Daily Plan</Text>

          {plan.map((amount, index) => (
            <View key={index} style={styles.planRow}>
              <Text style={styles.planDay}>Day {index + 1}</Text>
              <Text style={styles.planAmount}>${amount}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f5f7fb",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  loadingText: {
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  welcome: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  info: {
    fontSize: 16,
    color: "#444",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutButton: {
    backgroundColor: "#dc2626",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  planDay: {
    fontSize: 16,
    color: "#333",
  },
  planAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2563eb",
  },
});