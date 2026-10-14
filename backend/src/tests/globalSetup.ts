import "dotenv/config";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

// Recrea la base de test desde schema.sql antes de correr los tests
export default async function () {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: true,
  });
  const sql = fs.readFileSync(path.join(__dirname, "../../schema.sql"), "utf8").replace(/postulapp/g, "postulapp_test");
  await conn.query("DROP DATABASE IF EXISTS postulapp_test");
  await conn.query(sql);
  await conn.end();
}
