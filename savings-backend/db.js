const oracledb = require("oracledb");
require("dotenv").config();

async function getConnection() {
  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING,
    });

    console.log("Connected to Oracle Database");
    return connection;
  } catch (err) {
    console.error("Oracle connection error:", err);
    throw err;
  }
}

module.exports = { getConnection };