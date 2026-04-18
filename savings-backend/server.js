const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const oracledb = require("oracledb");
const { getConnection } = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running");
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  let connection;

  try {
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    connection = await getConnection();

    const existingUser = await connection.execute(
      `SELECT id FROM app_users WHERE email = :email`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await connection.execute(
      `INSERT INTO app_users (name, email, password)
       VALUES (:name, :email, :password)
       RETURNING id INTO :id`,
      {
        name,
        email,
        password: hashedPassword,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );

    await connection.commit();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: result.outBinds.id[0],
        name,
        email,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, name, email, password
       FROM app_users
       WHERE email = :email`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.PASSWORD);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.ID, name: user.NAME, email: user.EMAIL },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.ID, name: user.NAME, email: user.EMAIL },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// ─── ME ───────────────────────────────────────────────────────────────────────
app.get("/me", authMiddleware, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, name, email FROM app_users WHERE id = :id`,
      { id: req.user.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    res.json({ id: user.ID, name: user.NAME, email: user.EMAIL });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// ─── CREATE CHALLENGE ─────────────────────────────────────────────────────────
app.post("/create-challenge", authMiddleware, async (req, res) => {
  const { targetAmount, days } = req.body;
  let connection;

  try {
    if (!targetAmount || !days) {
      return res
        .status(400)
        .json({ message: "Target amount and days are required" });
    }

    if (Number(targetAmount) <= 0 || Number(days) <= 0) {
      return res
        .status(400)
        .json({ message: "Target amount and days must be greater than 0" });
    }

    connection = await getConnection();

    // Block if ANY existing challenge found for this user
    const existingChallenge = await connection.execute(
      `SELECT id
       FROM savings_challenges
       WHERE user_id = :user_id
       ORDER BY id DESC
       FETCH FIRST 1 ROWS ONLY`,
      { user_id: req.user.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existingChallenge.rows.length > 0) {
      return res.status(400).json({
        message: "You already have a plan. Clear it first before creating a new one.",
      });
    }

    // Generate random weighted daily amounts
    const weights = Array.from({ length: Number(days) }, () => Math.random() + 0.5);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const plan = weights.map((w) =>
      Math.floor((w / totalWeight) * Number(targetAmount))
    );

    // Fix rounding difference on last day
    const currentTotal = plan.reduce((sum, value) => sum + value, 0);
    const diff = Number(targetAmount) - currentTotal;
    plan[plan.length - 1] += diff;

    const challengeResult = await connection.execute(
      `INSERT INTO savings_challenges (user_id, target_amount, start_date, end_date, total_saved)
       VALUES (:user_id, :target_amount, TRUNC(SYSDATE), TRUNC(SYSDATE) + :days - 1, 0)
       RETURNING id INTO :id`,
      {
        user_id: req.user.id,
        target_amount: Number(targetAmount),
        days: Number(days),
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );

    const challengeId = challengeResult.outBinds.id[0];

    for (let i = 0; i < plan.length; i++) {
      await connection.execute(
        `INSERT INTO challenge_days (challenge_id, day_date, amount, completed)
         VALUES (:challenge_id, TRUNC(SYSDATE) + :day_offset, :amount, 0)`,
        { challenge_id: challengeId, day_offset: i, amount: plan[i] }
      );
    }

    await connection.commit();

    res.json({ message: "Challenge created successfully", challengeId });
  } catch (error) {
    console.error("Create challenge error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error(err); }
    }
  }
});

// ─── LATEST CHALLENGE ─────────────────────────────────────────────────────────
app.get("/latest-challenge", authMiddleware, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    // Get most recent challenge — no date filter
    const challengeResult = await connection.execute(
      `SELECT id, target_amount, total_saved
       FROM savings_challenges
       WHERE user_id = :user_id
       ORDER BY id DESC
       FETCH FIRST 1 ROWS ONLY`,
      { user_id: req.user.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (challengeResult.rows.length === 0) {
      return res.json({ challenge: null, days: [] });
    }

    const challenge = challengeResult.rows[0];

    const daysResult = await connection.execute(
      `SELECT id, amount, completed, day_date
       FROM challenge_days
       WHERE challenge_id = :challenge_id
       ORDER BY day_date ASC`,
      { challenge_id: challenge.ID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const days = daysResult.rows.map((row, index) => ({
      id: row.ID,
      dayNumber: index + 1,
      amount: row.AMOUNT,
      completed: Number(row.COMPLETED) === 1,
      dayDate: row.DAY_DATE,
    }));

    res.json({
      challenge: {
        id: challenge.ID,
        targetAmount: challenge.TARGET_AMOUNT,
        totalSaved: challenge.TOTAL_SAVED || 0,
      },
      days,
    });
  } catch (error) {
    console.error("Latest challenge error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error(err); }
    }
  }
});

// ─── TOGGLE DAY ───────────────────────────────────────────────────────────────
app.patch("/challenge-day/:dayId/toggle", authMiddleware, async (req, res) => {
  const { dayId } = req.params;
  let connection;

  try {
    connection = await getConnection();

    const dayResult = await connection.execute(
      `SELECT cd.id, cd.amount, cd.completed, cd.challenge_id
       FROM challenge_days cd
       JOIN savings_challenges sc ON sc.id = cd.challenge_id
       WHERE cd.id = :day_id AND sc.user_id = :user_id`,
      { day_id: Number(dayId), user_id: req.user.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (dayResult.rows.length === 0) {
      return res.status(404).json({ message: "Plan day not found" });
    }

    const day = dayResult.rows[0];
    const newCompleted = Number(day.COMPLETED) === 1 ? 0 : 1;
    const amountDiff = newCompleted === 1 ? Number(day.AMOUNT) : -Number(day.AMOUNT);

    await connection.execute(
      `UPDATE challenge_days SET completed = :completed WHERE id = :day_id`,
      { completed: newCompleted, day_id: Number(dayId) }
    );

    await connection.execute(
      `UPDATE savings_challenges
       SET total_saved = NVL(total_saved, 0) + :amount_diff
       WHERE id = :challenge_id`,
      { amount_diff: amountDiff, challenge_id: day.CHALLENGE_ID }
    );

    await connection.commit();

    res.json({ message: "Day updated successfully", completed: newCompleted === 1 });
  } catch (error) {
    console.error("Toggle day error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error(err); }
    }
  }
});

// ─── CLEAR CHALLENGE ──────────────────────────────────────────────────────────
// FIX: Removed end_date filter — finds and deletes any existing plan for the user
app.delete("/clear-challenge", authMiddleware, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    // No end_date filter — always finds the latest plan regardless of dates
    const challengeResult = await connection.execute(
      `SELECT id
       FROM savings_challenges
       WHERE user_id = :user_id
       ORDER BY id DESC
       FETCH FIRST 1 ROWS ONLY`,
      { user_id: req.user.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (challengeResult.rows.length === 0) {
      return res.status(404).json({ message: "No plan found to clear" });
    }

    const challengeId = challengeResult.rows[0].ID;

    // Delete child rows first (foreign key constraint)
    await connection.execute(
      `DELETE FROM challenge_days WHERE challenge_id = :challenge_id`,
      { challenge_id: challengeId }
    );

    await connection.execute(
      `DELETE FROM savings_challenges WHERE id = :challenge_id`,
      { challenge_id: challengeId }
    );

    await connection.commit();

    res.json({ message: "Plan cleared successfully" });
  } catch (error) {
    console.error("Clear challenge error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error(err); }
    }
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});