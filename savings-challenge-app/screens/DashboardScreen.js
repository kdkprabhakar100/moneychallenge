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
  ActivityIndicator,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:5000";
const { width } = Dimensions.get("window");

// ── Design Tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: "#0f1117",
  surface: "#1a1d27",
  surfaceAlt: "#20232f",
  border: "#2a2d3a",
  borderLight: "#32364a",
  accent: "#00d97e",
  accentDim: "#00d97e22",
  accentText: "#00d97e",
  danger: "#ff4d6d",
  dangerDim: "#ff4d6d18",
  warning: "#ffb547",
  warningDim: "#ffb54718",
  blue: "#4f8ef7",
  blueDim: "#4f8ef718",
  textPrimary: "#f0f2ff",
  textSecondary: "#8b8fa8",
  textMuted: "#52566e",
  white: "#ffffff",
};

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
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to load user");
        return;
      }
      setUser(data);
    } catch (error) {
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
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to load challenge");
        return;
      }
      setChallengeInfo(data.challenge || null);
      setPlanDays(data.days || []);
    } catch (error) {
      Alert.alert("Error", "Could not fetch challenge data");
    } finally {
      setLoadingChallenge(false);
    }
  };

  const createChallenge = async () => {
    if (!target.trim() || !days.trim()) {
      Alert.alert("Missing Fields", "Please enter target amount and number of days");
      return;
    }
    if (Number(target) <= 0 || Number(days) <= 0) {
      Alert.alert("Invalid Input", "Target amount and days must be greater than 0");
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
      if (!response.ok) {
        Alert.alert("Error", data.message || data.error || "Failed to create challenge");
        return;
      }
      setTarget("");
      setDays("");
      await fetchLatestChallenge();
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false });
      }, 50);
      Alert.alert("🎉 Success", "Your savings plan is ready!");
    } catch (error) {
      Alert.alert("Error", "Could not create challenge. Is the server running?");
    } finally {
      setCreatingChallenge(false);
    }
  };

  const toggleDayComplete = async (dayId) => {
    try {
      const response = await fetch(`${API_URL}/challenge-day/${dayId}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
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
      Alert.alert("Error", "Could not update day");
    }
  };

  const clearPlanRequest = async () => {
    try {
      setClearingPlan(true);
      const response = await fetch(`${API_URL}/clear-challenge`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to clear plan");
        return;
      }
      setPlanDays([]);
      setChallengeInfo(null);
      setFilter("all");
      setTarget("");
      setDays("");
      Alert.alert("Cleared", "Plan cleared successfully");
    } catch (error) {
      Alert.alert("Error", "Could not clear plan");
    } finally {
      setClearingPlan(false);
    }
  };

  const clearPlan = async () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to delete the current plan?");
      if (!confirmed) return;
      await clearPlanRequest();
      return;
    }
    Alert.alert("Clear Plan", "Are you sure you want to delete the current plan?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clearPlanRequest() },
    ]);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      setToken(null);
    } catch (error) {
      Alert.alert("Error", "Could not logout");
    }
  };

  const filteredPlan = useMemo(() => {
    if (filter === "completed") return planDays.filter((item) => item.completed);
    if (filter === "pending") return planDays.filter((item) => !item.completed);
    return planDays;
  }, [planDays, filter]);

  const completedCount = planDays.filter((item) => item.completed).length;
  const pendingCount = planDays.filter((item) => !item.completed).length;
  const hasActivePlan = planDays.length > 0;

  const progressPercent = challengeInfo
    ? Math.min(
        Math.round(
          (Number(challengeInfo.totalSaved || 0) /
            Number(challengeInfo.targetAmount || 1)) * 100
        ),
        100
      )
    : 0;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>₹</Text>
          </View>
          <View>
            <Text style={styles.appName}>Money Challenge</Text>
            <Text style={styles.appSub}>Savings Tracker</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── User Card ── */}
      {loadingUser ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={C.accent} size="small" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : user ? (
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {user.name?.charAt(0)?.toUpperCase() ?? "U"}
            </Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName}>👋 {user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
          <View style={styles.userIdBadge}>
            <Text style={styles.userIdText}>#{user.id}</Text>
          </View>
        </View>
      ) : null}

      {/* ── Create Challenge ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🎯</Text>
          <View>
            <Text style={styles.cardTitle}>New Challenge</Text>
            <Text style={styles.cardSub}>
              {hasActivePlan ? "Clear current plan to start fresh" : "Set your savings target"}
            </Text>
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>TARGET (₹)</Text>
            <TextInput
              style={[styles.input, hasActivePlan && styles.inputDisabled]}
              placeholder="100000"
              placeholderTextColor={C.textMuted}
              value={target}
              onChangeText={setTarget}
              keyboardType="numeric"
              editable={!hasActivePlan}
            />
          </View>
          <View style={[styles.inputWrap, { marginLeft: 10 }]}>
            <Text style={styles.inputLabel}>DAYS</Text>
            <TextInput
              style={[styles.input, hasActivePlan && styles.inputDisabled]}
              placeholder="30"
              placeholderTextColor={C.textMuted}
              value={days}
              onChangeText={setDays}
              keyboardType="numeric"
              editable={!hasActivePlan}
            />
          </View>
        </View>

        {!hasActivePlan ? (
          <TouchableOpacity
            style={[styles.accentBtn, creatingChallenge && styles.accentBtnDisabled]}
            onPress={createChallenge}
            disabled={creatingChallenge}
            activeOpacity={0.85}
          >
            {creatingChallenge ? (
              <ActivityIndicator color={C.bg} size="small" />
            ) : (
              <Text style={styles.accentBtnText}>Generate Plan</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.dangerBtn, clearingPlan && styles.dangerBtnDisabled]}
            onPress={clearPlan}
            disabled={clearingPlan}
            activeOpacity={0.85}
          >
            {clearingPlan ? (
              <ActivityIndicator color={C.white} size="small" />
            ) : (
              <Text style={styles.dangerBtnText}>🗑  Clear Current Plan</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Plan Summary ── */}
      {challengeInfo && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📊</Text>
            <View>
              <Text style={styles.cardTitle}>Plan Summary</Text>
              <Text style={styles.cardSub}>Track your progress</Text>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCell, { borderColor: C.blue }]}>
              <Text style={[styles.statValue, { color: C.blue }]}>
                ₹{Number(challengeInfo.targetAmount).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Target</Text>
            </View>
            <View style={[styles.statCell, { borderColor: C.accent }]}>
              <Text style={[styles.statValue, { color: C.accent }]}>
                ₹{Number(challengeInfo.totalSaved || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>
            <View style={[styles.statCell, { borderColor: C.warning }]}>
              <Text style={[styles.statValue, { color: C.warning }]}>
                {planDays.length}
              </Text>
              <Text style={styles.statLabel}>Days</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progressWrap}>
            <View style={styles.progressMeta}>
              <Text style={styles.progressLabel}>
                ✅ {completedCount} done · ⏳ {pendingCount} left
              </Text>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercent}%` },
                  progressPercent === 100 && { backgroundColor: C.accent },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {/* ── Daily Plan ── */}
      {loadingChallenge ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={C.accent} size="small" />
          <Text style={styles.loadingText}>Loading plan...</Text>
        </View>
      ) : hasActivePlan ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📅</Text>
            <View>
              <Text style={styles.cardTitle}>Daily Plan</Text>
              <Text style={styles.cardSub}>Tap a day to mark it done</Text>
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterRow}>
            {[
              { key: "all", label: `All (${planDays.length})` },
              { key: "pending", label: `Pending (${pendingCount})` },
              { key: "completed", label: `Done (${completedCount})` },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Day Rows */}
          {filteredPlan.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>
                {filter === "completed" ? "🎉" : "📭"}
              </Text>
              <Text style={styles.emptyText}>
                {filter === "completed"
                  ? "No days completed yet. Keep going!"
                  : "All days are done. Amazing!"}
              </Text>
            </View>
          ) : (
            filteredPlan.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.dayRow,
                  item.completed && styles.dayRowDone,
                  index === filteredPlan.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => toggleDayComplete(item.id)}
                activeOpacity={0.7}
              >
                {/* Checkbox */}
                <View style={[styles.cb, item.completed && styles.cbDone]}>
                  {item.completed && <Text style={styles.cbCheck}>✓</Text>}
                </View>

                {/* Day Info */}
                <View style={styles.dayMeta}>
                  <Text style={[styles.dayNum, item.completed && styles.dayNumDone]}>
                    Day {item.dayNumber}
                  </Text>
                  {item.dayDate ? (
                    <Text style={styles.dayDate}>
                      {new Date(item.dayDate).toDateString()}
                    </Text>
                  ) : null}
                </View>

                {/* Amount Badge */}
                <View style={[styles.amtBadge, item.completed && styles.amtBadgeDone]}>
                  <Text style={[styles.amtText, item.completed && styles.amtTextDone]}>
                    ₹{Number(item.amount).toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View style={styles.noplanCard}>
          <Text style={styles.noplanEmoji}>💡</Text>
          <Text style={styles.noplanTitle}>No active challenge</Text>
          <Text style={styles.noplanSub}>Create one above to get started</Text>
        </View>
      )}

      {/* Bottom spacer */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 36,
    paddingBottom: 48,
  },

  // ── Header ──────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  logoMarkText: {
    fontSize: 22,
    fontWeight: "800",
    color: C.bg,
  },
  appName: {
    fontSize: 18,
    fontWeight: "800",
    color: C.textPrimary,
    letterSpacing: -0.3,
  },
  appSub: {
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: C.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutText: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "600",
  },

  // ── Loading ──────────────────────────────
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    marginVertical: 16,
  },
  loadingText: {
    color: C.textSecondary,
    fontSize: 14,
  },

  // ── User Card ────────────────────────────
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.accentDim,
    borderWidth: 2,
    borderColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: C.accent,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: C.textSecondary,
  },
  userIdBadge: {
    backgroundColor: C.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  userIdText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
  },

  // ── Card ─────────────────────────────────
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    color: C.textMuted,
  },

  // ── Inputs ───────────────────────────────
  inputRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  inputWrap: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.surfaceAlt,
    borderWidth: 1.5,
    borderColor: C.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: C.textPrimary,
    fontWeight: "600",
  },
  inputDisabled: {
    opacity: 0.4,
  },

  // ── Buttons ──────────────────────────────
  accentBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  accentBtnDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  accentBtnText: {
    color: C.bg,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  dangerBtn: {
    backgroundColor: C.dangerDim,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.danger,
  },
  dangerBtnDisabled: {
    opacity: 0.5,
  },
  dangerBtnText: {
    color: C.danger,
    fontSize: 15,
    fontWeight: "700",
  },

  // ── Stats Grid ───────────────────────────
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCell: {
    flex: 1,
    backgroundColor: C.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderTopWidth: 3,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // ── Progress ─────────────────────────────
  progressWrap: {
    gap: 8,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 12,
    color: C.textSecondary,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: "800",
    color: C.accent,
  },
  progressTrack: {
    height: 8,
    backgroundColor: C.surfaceAlt,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  progressFill: {
    height: "100%",
    backgroundColor: C.blue,
    borderRadius: 999,
  },

  // ── Filter Tabs ──────────────────────────
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  filterTabActive: {
    backgroundColor: C.accentDim,
    borderColor: C.accent,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSecondary,
  },
  filterTabTextActive: {
    color: C.accent,
  },

  // ── Day Rows ─────────────────────────────
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  dayRowDone: {
    opacity: 0.65,
  },
  cb: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.borderLight,
    backgroundColor: C.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  cbDone: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  cbCheck: {
    color: C.bg,
    fontSize: 13,
    fontWeight: "800",
  },
  dayMeta: {
    flex: 1,
  },
  dayNum: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textPrimary,
  },
  dayNumDone: {
    textDecorationLine: "line-through",
    color: C.textMuted,
  },
  dayDate: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },
  amtBadge: {
    backgroundColor: C.blueDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.blue + "44",
  },
  amtBadgeDone: {
    backgroundColor: C.accentDim,
    borderColor: C.accent + "44",
  },
  amtText: {
    fontSize: 13,
    fontWeight: "800",
    color: C.blue,
  },
  amtTextDone: {
    color: C.accent,
  },

  // ── Empty / No Plan ──────────────────────
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
  },
  noplanCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "dashed",
    gap: 8,
  },
  noplanEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  noplanTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textPrimary,
  },
  noplanSub: {
    fontSize: 13,
    color: C.textMuted,
  },
});