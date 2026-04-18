import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:5000";

export default function DashboardScreen({ token, setToken }) {
  const [user, setUser] = useState(null);
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("");
  const [planDays, setPlanDays] = useState([]);
  const [challengeInfo, setChallengeInfo] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [clearingPlan, setClearingPlan] = useState(false);
  const [filter, setFilter] = useState("all");

  const scrollRef = useRef(null);

  useEffect(() => {
    if (token) {
      fetchUser();
      fetchLatestChallenge();
    }
  }, [token]);

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
      Alert.alert("Error", "Could not fetch user data. Is the server running?");
    } finally {
      setLoadingUser(false);
    }
  };

  const fetchLatestChallenge = async () => {
    try {
      setLoadingChallenge(true);

      const response = await fetch(`${API_URL}/latest-challenge`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log("Latest challenge data:", data);

      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to load challenge");
        return;
      }

      setChallengeInfo(data.challenge || null);
      setPlanDays(data.days || []);
    } catch (error) {
      console.log("Fetch latest challenge error:", error);
      Alert.alert("Error", "Could not fetch challenge data");
    } finally {
      setLoadingChallenge(false);
    }
  };

  const createChallenge = async () => {
    if (!target.trim() || !days.trim()) {
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
        Alert.alert(
          "Error",
          data.message || data.error || "Failed to create challenge"
        );
        return;
      }

      setTarget("");
      setDays("");

      await fetchLatestChallenge();

      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ y: 0, animated: false });
        }
      }, 50);

      Alert.alert("Success", "Challenge created successfully!");
    } catch (error) {
      console.log("Create challenge error:", error);
      Alert.alert("Error", "Could not create challenge. Is the server running?");
    } finally {
      setCreatingChallenge(false);
    }
  };

  const toggleDayComplete = async (dayId) => {
    try {
      const response = await fetch(`${API_URL}/challenge-day/${dayId}/toggle`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log("Toggle response:", data);

      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to update day");
        return;
      }

      const selectedDay = planDays.find((d) => d.id === dayId);

      setPlanDays((prev) =>
        prev.map((item) =>
          item.id === dayId ? { ...item, completed: data.completed } : item
        )
      );

      setChallengeInfo((prev) => {
        if (!prev || !selectedDay) return prev;

        return {
          ...prev,
          totalSaved: data.completed
            ? Number(prev.totalSaved || 0) + Number(selectedDay.amount)
            : Number(prev.totalSaved || 0) - Number(selectedDay.amount),
        };
      });
    } catch (error) {
      console.log("Toggle complete error:", error);
      Alert.alert("Error", "Could not update day");
    }
  };

  const clearPlanRequest = async () => {
    try {
      setClearingPlan(true);

      const response = await fetch(`${API_URL}/clear-challenge`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log("Clear plan response:", data);

      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to clear plan");
        return;
      }

      setPlanDays([]);
      setChallengeInfo(null);
      setFilter("all");
      setTarget("");
      setDays("");

      Alert.alert("Success", "Plan cleared successfully");
    } catch (error) {
      console.log("Clear plan error:", error);
      Alert.alert("Error", "Could not clear plan");
    } finally {
      setClearingPlan(false);
    }
  };

  const clearPlan = async () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to delete the current plan?"
      );

      if (!confirmed) return;

      await clearPlanRequest();
      return;
    }

    Alert.alert("Clear Plan", "Are you sure you want to delete the current plan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          clearPlanRequest();
        },
      },
    ]);
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

  const filteredPlan = useMemo(() => {
    if (filter === "completed") {
      return planDays.filter((item) => item.completed);
    }

    if (filter === "pending") {
      return planDays.filter((item) => !item.completed);
    }

    return planDays;
  }, [planDays, filter]);

  const completedCount = planDays.filter((item) => item.completed).length;
  const pendingCount = planDays.filter((item) => !item.completed).length;
  const hasActivePlan = planDays.length > 0;

  const progressPercent = challengeInfo
    ? Math.min(
        Math.round(
          (Number(challengeInfo.totalSaved || 0) /
            Number(challengeInfo.targetAmount || 1)) *
            100
        ),
        100
      )
    : 0;

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.dashboardContainer}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Money Challenge App</Text>

        <TouchableOpacity style={styles.topLogoutButton} onPress={handleLogout}>
          <Text style={styles.topLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {loadingUser ? (
        <Text style={styles.loadingText}>Loading user...</Text>
      ) : user ? (
        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome, {user.name} 👋</Text>
          <Text style={styles.info}>Email: {user.email}</Text>
          <Text style={styles.info}>User ID: {user.id}</Text>
        </View>
      ) : (
        <Text style={styles.loadingText}>Could not load user</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create Challenge</Text>

        <TextInput
          style={[styles.input, hasActivePlan && styles.inputDisabled]}
          placeholder="Target Amount (e.g. 100000)"
          placeholderTextColor="#9ca3af"
          value={target}
          onChangeText={setTarget}
          keyboardType="numeric"
          editable={!hasActivePlan}
        />

        <TextInput
          style={[styles.input, hasActivePlan && styles.inputDisabled]}
          placeholder="Number of Days (e.g. 30)"
          placeholderTextColor="#9ca3af"
          value={days}
          onChangeText={setDays}
          keyboardType="numeric"
          editable={!hasActivePlan}
        />

        <TouchableOpacity
          style={[
            styles.button,
            (hasActivePlan || creatingChallenge) && styles.disabledButton,
          ]}
          onPress={createChallenge}
          disabled={hasActivePlan || creatingChallenge}
        >
          <Text style={styles.buttonText}>
            {creatingChallenge
              ? "Creating..."
              : hasActivePlan
              ? "Plan Already Exists"
              : "Create Challenge"}
          </Text>
        </TouchableOpacity>

        {hasActivePlan && (
          <TouchableOpacity
            style={[styles.clearButton, clearingPlan && styles.disabledClearButton]}
            onPress={clearPlan}
            disabled={clearingPlan}
          >
            <Text style={styles.buttonText}>
              {clearingPlan ? "Clearing..." : "🗑 Clear Current Plan"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {challengeInfo && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Plan Summary</Text>
          <Text style={styles.info}>
            🎯 Target: Rs{Number(challengeInfo.targetAmount).toLocaleString()}
          </Text>
          <Text style={styles.info}>
            💰 Saved: Rs{Number(challengeInfo.totalSaved || 0).toLocaleString()}
          </Text>
          <Text style={styles.info}>✅ Completed Days: {completedCount}</Text>
          <Text style={styles.info}>⏳ Pending Days: {pendingCount}</Text>

          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.progressText}>{progressPercent}% saved</Text>
        </View>
      )}

      {loadingChallenge ? (
        <Text style={styles.loadingText}>Loading plan...</Text>
      ) : hasActivePlan ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daily Plan</Text>

          <View style={styles.filterRow}>
            {["all", "pending", "completed"].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterButton, filter === f && styles.activeFilter]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === f && styles.activeFilterText,
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredPlan.length === 0 ? (
            <Text style={styles.emptyText}>No days in this filter.</Text>
          ) : (
            filteredPlan.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.planRow, item.completed && styles.completedRow]}
                onPress={() => toggleDayComplete(item.id)}
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

                  <View>
                    <Text
                      style={[
                        styles.planDay,
                        item.completed && styles.completedText,
                      ]}
                    >
                      Day {item.dayNumber}
                    </Text>

                    {item.dayDate ? (
                      <Text style={styles.dateText}>
                        {new Date(item.dayDate).toDateString()}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Text
                  style={[
                    styles.planAmount,
                    item.completed && styles.completedAmount,
                  ]}
                >
                  Rs{Number(item.amount).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No active challenge yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dashboardContainer: {
    backgroundColor: "#f5f7fb",
    padding: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    flex: 1,
    color: "#111827",
  },
  topLogoutButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  topLogoutText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  loadingText: {
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
  },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    paddingVertical: 12,
    fontSize: 15,
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
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: "#111827",
  },
  info: {
    fontSize: 15,
    color: "#444",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 14,
    color: "#111827",
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
    color: "#111",
  },
  inputDisabled: {
    backgroundColor: "#f1f5f9",
    color: "#94a3b8",
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#94a3b8",
  },
  clearButton: {
    backgroundColor: "#dc2626",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  disabledClearButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    marginTop: 12,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#16a34a",
    borderRadius: 999,
  },
  progressText: {
    fontSize: 13,
    color: "#16a34a",
    fontWeight: "600",
    marginTop: 6,
    textAlign: "right",
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  filterButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  activeFilter: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  filterText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 13,
  },
  activeFilterText: {
    color: "#fff",
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  planDay: {
    fontSize: 15,
    color: "#333",
  },
  dateText: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  planAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2563eb",
  },
  completedRow: {
    backgroundColor: "#f0fdf4",
  },
  completedText: {
    textDecorationLine: "line-through",
    color: "#94a3b8",
  },
  completedAmount: {
    color: "#16a34a",
  },
});