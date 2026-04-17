app.get("/test-db", async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT USER AS username FROM dual`,
      [],
      { outFormat: require("oracledb").OUT_FORMAT_OBJECT }
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.log(e);
      }
    }
  }
});