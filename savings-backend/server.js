const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
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

  try {
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    const existingUser = await pool.query(
      `SELECT id FROM app_users WHERE email = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO app_users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT id, name, email, password
       FROM app_users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ─── ME ───────────────────────────────────────────────────────────────────────
app.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email FROM app_users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ─── CREATE CHALLENGE ─────────────────────────────────────────────────────────
app.post("/create-challenge", authMiddleware, async (req, res) => {
  const { targetAmount, days } = req.body;
  const client = await pool.connect();

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

    await client.query("BEGIN");

    const existingChallenge = await client.query(
      `SELECT id
       FROM savings_challenges
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (existingChallenge.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "You already have a plan. Clear it first before creating a new one.",
      });
    }

    const weights = Array.from({ length: Number(days) }, () => Math.random() + 0.5);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const plan = weights.map((w) =>
      Math.floor((w / totalWeight) * Number(targetAmount))
    );

    const currentTotal = plan.reduce((sum, value) => sum + value, 0);
    const diff = Number(targetAmount) - currentTotal;
    plan[plan.length - 1] += diff;

    const challengeResult = await client.query(
      `INSERT INTO savings_challenges (user_id, target_amount, start_date, end_date, total_saved)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + (($3::int) - 1), 0)
       RETURNING id`,
      [req.user.id, Number(targetAmount), Number(days)]
    );

    const challengeId = challengeResult.rows[0].id;

    for (let i = 0; i < plan.length; i++) {
      await client.query(
        `INSERT INTO challenge_days (challenge_id, day_date, amount, completed)
         VALUES ($1, CURRENT_DATE + ($2::int), $3, FALSE)`,
        [challengeId, i, plan[i]]
      );
    }

    await client.query("COMMIT");

    res.json({ message: "Challenge created successfully", challengeId });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create challenge error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    client.release();
  }
});

// ─── LATEST CHALLENGE ─────────────────────────────────────────────────────────
app.get("/latest-challenge", authMiddleware, async (req, res) => {
  try {
    const challengeResult = await pool.query(
      `SELECT id, target_amount, total_saved
       FROM savings_challenges
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (challengeResult.rows.length === 0) {
      return res.json({ challenge: null, days: [] });
    }

    const challenge = challengeResult.rows[0];

    const daysResult = await pool.query(
      `SELECT id, amount, completed, day_date
       FROM challenge_days
       WHERE challenge_id = $1
       ORDER BY day_date ASC`,
      [challenge.id]
    );

    const days = daysResult.rows.map((row, index) => ({
      id: row.id,
      dayNumber: index + 1,
      amount: Number(row.amount),
      completed: row.completed,
      dayDate: row.day_date,
    }));

    res.json({
      challenge: {
        id: challenge.id,
        targetAmount: Number(challenge.target_amount),
        totalSaved: Number(challenge.total_saved || 0),
      },
      days,
    });
  } catch (error) {
    console.error("Latest challenge error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── TOGGLE DAY ───────────────────────────────────────────────────────────────
app.patch("/challenge-day/:dayId/toggle", authMiddleware, async (req, res) => {
  const { dayId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const dayResult = await client.query(
      `SELECT cd.id, cd.amount, cd.completed, cd.challenge_id
       FROM challenge_days cd
       JOIN savings_challenges sc ON sc.id = cd.challenge_id
       WHERE cd.id = $1 AND sc.user_id = $2`,
      [Number(dayId), req.user.id]
    );

    if (dayResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Plan day not found" });
    }

    const day = dayResult.rows[0];
    const newCompleted = !day.completed;
    const amountDiff = newCompleted ? Number(day.amount) : -Number(day.amount);

    await client.query(
      `UPDATE challenge_days
       SET completed = $1
       WHERE id = $2`,
      [newCompleted, Number(dayId)]
    );

    await client.query(
      `UPDATE savings_challenges
       SET total_saved = COALESCE(total_saved, 0) + $1
       WHERE id = $2`,
      [amountDiff, day.challenge_id]
    );

    await client.query("COMMIT");

    res.json({ message: "Day updated successfully", completed: newCompleted });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Toggle day error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    client.release();
  }
});

// ─── CLEAR CHALLENGE ──────────────────────────────────────────────────────────
app.delete("/clear-challenge", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const challengeResult = await client.query(
      `SELECT id
       FROM savings_challenges
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (challengeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No plan found to clear" });
    }

    const challengeId = challengeResult.rows[0].id;

    await client.query(
      `DELETE FROM challenge_days WHERE challenge_id = $1`,
      [challengeId]
    );

    await client.query(
      `DELETE FROM savings_challenges WHERE id = $1`,
      [challengeId]
    );

    await client.query("COMMIT");

    res.json({ message: "Plan cleared successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Clear challenge error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    client.release();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});