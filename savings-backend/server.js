const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const oracledb = require("oracledb");
const { getConnection } = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running");
});

app.get("/test-db", async (req, res) => {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT 'Oracle connection successful' AS message FROM dual`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.error(e);
      }
    }
  }
});

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

    if (user.PASSWORD !== password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        id: user.ID,
        name: user.NAME,
        email: user.EMAIL,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.ID,
        name: user.NAME,
        email: user.EMAIL,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.error(e);
      }
    }
  }
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

app.get("/me", authMiddleware, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, name, email
       FROM app_users
       WHERE id = :id`,
      { id: req.user.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    res.json({
      id: user.ID,
      name: user.NAME,
      email: user.EMAIL,
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.error(e);
      }
    }
  }
});

app.post("/create-challenge", authMiddleware, async (req, res) => {
  const { targetAmount, days } = req.body;
  let connection;

  try {
    if (!targetAmount || !days) {
      return res.status(400).json({ message: "Target amount and days are required" });
    }

    if (Number(targetAmount) <= 0 || Number(days) <= 0) {
      return res.status(400).json({ message: "Target amount and days must be greater than 0" });
    }

    connection = await getConnection();

    const weights = Array.from({ length: Number(days) }, () => Math.random() + 0.5);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const plan = weights.map((w) =>
      Math.floor((w / totalWeight) * Number(targetAmount))
    );

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
        {
          challenge_id: challengeId,
          day_offset: i,
          amount: plan[i],
        }
      );
    }

    await connection.commit();

    res.json({
      message: "Challenge created successfully",
      challengeId,
      plan,
    });
  } catch (error) {
    console.error("Create challenge error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});