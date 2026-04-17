import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://192.168.18.189:5000";

type UserType = {
  id: number;
  name: string;
  email: string;
};

type DayItem = {
  dayNumber: number;
  amount: number;
  completed: boolean;
  month: number;
};

export default function Index() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserType | null>(null);
  const [email, setEmail] = useState("ash@example.com");
  const [password, setPassword] = useState("123456");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("");
  const [plan, setPlan] = useState<DayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  useEffect(() => {
    checkSavedToken();
  }, []);

  const checkSavedToken = async () => {
    try {
      const savedToken = await AsyncStorage.getItem("token");
      const savedPlan = await AsyncStorage.getItem("challengePlan");

      if (savedToken) {
        setToken(savedToken);
        fetchMe(savedToken);
      }

      if (savedPlan) {
        setPlan(JSON.parse(savedPlan));
      }
    } catch (error) {
      console.log("Check token error:", error);
    }
  };

  const loginUser = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();
      console.log("Login response:", data);

      if (!response.ok) {
        Alert.alert("Error", data.message || "Login failed");
        return;
      }

      await AsyncStorage.setItem("token", data.token);
      setToken(data.token);
      fetchMe(data.token);
    } catch (error) {
      console.log("Login error:", error);
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  const fetchMe = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await response.json();
      console.log("Me response:", data);

      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to fetch user");
        return;
      }

      setUser(data);
    } catch (error) {
      console.log("Fetch me error:", error);
      Alert.alert("Error", "Could not fetch user data");
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

      const structuredPlan: DayItem[] = (data.plan || []).map(
        (amount: number, index: number) => ({
          dayNumber: index + 1,
          amount,
          completed: false,
          month: Math.floor(index / 30) + 1,
        })
      );

      setPlan(structuredPlan);
      await AsyncStorage.setItem("challengePlan", JSON.stringify(structuredPlan));

      setTarget("");
      setDays("");
      Alert.alert("Success", "Challenge created successfully");
    } catch (error) {
      console.log("Create challenge error:", error);
      Alert.alert("Error", "Could not create challenge");
    } finally {
      setCreatingChallenge(false);
    }
  };


  const toggleDayCompleted = async (dayNumber: number) => {
    const updatedPlan = plan.map((item) =>
      item.dayNumber === dayNumber
        ? { ...item, completed: !item.completed }
        : item
    );

    setPlan(updatedPlan);
    await AsyncStorage.setItem("challengePlan", JSON.stringify(updatedPlan));
  };

  const logoutUser = async () => {
    try {
      await AsyncStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

    const clearChallenge = async () => {
    try {
        setPlan([]);
        await AsyncStorage.removeItem("challengePlan");
        Alert.alert("Success", "Challenge cleared");
    } catch (error) {
        console.log("Clear challenge error:", error);
        Alert.alert("Error", "Could not clear challenge");
    }
    };

  const groupedByMonth = plan.reduce((acc: Record<number, DayItem[]>, item) => {
    if (!acc[item.month]) {
      acc[item.month] = [];
    }
    acc[item.month].push(item);
    return acc;
  }, {});

  if (token && user) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>User Dashboard</Text>

        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome, {user.name}</Text>
          <Text style={styles.info}>Email: {user.email}</Text>
          <Text style={styles.info}>User ID: {user.id}</Text>
        </View>

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

          {plan.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearChallenge}>
              <Text style={styles.buttonText}>Clear Challenge</Text>
            </TouchableOpacity>
          )}
        </View>

        {Object.keys(groupedByMonth).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Savings Plan by Month</Text>

            {Object.entries(groupedByMonth).map(([month, monthDays]) => (
              <View key={month} style={styles.monthBlock}>
                <Text style={styles.monthTitle}>Month {month}</Text>

                {monthDays.map((item) => (
                  <TouchableOpacity
                    key={item.dayNumber}
                    style={[
                      styles.dayRow,
                      item.completed && styles.dayRowCompleted,
                    ]}
                    onPress={() => toggleDayCompleted(item.dayNumber)}
                  >
                    <View style={styles.leftRow}>
                      <View
                        style={[
                          styles.checkbox,
                          item.completed && styles.checkboxChecked,
                        ]}
                      >
                        {item.completed && <Text style={styles.checkmark}>✓</Text>}
                      </View>

                      <Text
                        style={[
                          styles.dayText,
                          item.completed && styles.completedText,
                        ]}
                      >
                        Day {item.dayNumber}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.amountText,
                        item.completed && styles.completedAmount,
                      ]}
                    >
                      ${item.amount}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={logoutUser}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Money Challenge App</Text>
      <Text style={styles.subtitle}>Login</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={loginUser}>
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "Login"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    flex: 1,
    backgroundColor: "#f5f7fb",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 24,
    color: "#666",
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
    marginBottom: 10,
  },
  clearButton: {
    backgroundColor: "#6b7280",
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
  monthBlock: {
    marginBottom: 22,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    color: "#111827",
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    borderRadius: 10,
  },
  dayRowCompleted: {
    backgroundColor: "#dcfce7",
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#9ca3af",
    borderRadius: 6,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  checkmark: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  dayText: {
    fontSize: 16,
    color: "#333",
  },
  amountText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2563eb",
  },
  completedText: {
    color: "#166534",
    fontWeight: "700",
  },
  completedAmount: {
    color: "#166534",
  },
});