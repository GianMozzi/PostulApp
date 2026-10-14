import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, dateStrings: true,
  ssl: process.env.DB_SSL === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
});
const SECRET = process.env.JWT_SECRET ?? "dev-secret";

const ENUMS: Record<string, string[]> = {
  modality: ["remote", "hybrid", "onsite"],
  priority: ["low", "medium", "high"],
  status: ["wishlist", "applied", "interview", "technical", "offer", "rejected"],
  experience: ["junior", "semi", "senior"],
};
const FIELDS = ["title", "company", "location", "modality", "priority", "status", "experience", "technologies",
  "language", "applied_date", "interview_date", "contact", "next_step", "notes"];

function validate(body: any, partial: boolean): string | null {
  if (!partial) for (const f of ["title", "company"]) if (!body[f]?.toString().trim()) return `El campo ${f} es obligatorio`;
  for (const [f, allowed] of Object.entries(ENUMS))
    if (body[f] !== undefined && body[f] !== "" && body[f] !== null && !allowed.includes(body[f])) return `Valor inválido en ${f}`;
  return null;
}

// Express 4 no captura errores async: este wrapper los manda al middleware de errores
type H = (req: any, res: Response) => Promise<unknown>;
const h = (fn: H) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

function auth(req: any, res: Response, next: NextFunction) {
  try { req.userId = (jwt.verify((req.headers.authorization ?? "").replace("Bearer ", ""), SECRET) as any).id; next(); }
  catch { res.status(401).json({ error: "Sesión inválida, volvé a iniciar sesión" }); }
}
const token = (id: number) => jwt.sign({ id }, SECRET, { expiresIn: "7d" });

export const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL ?? true }));
app.get("/health", (_req, res) => { res.json({ ok: true }); });
app.use(express.json());

app.post("/api/auth/register", h(async (req, res) => {
  const { name = "", email, password } = req.body;
  if (!email?.includes("@") || !password || password.length < 6)
    return res.status(400).json({ error: "Email válido y contraseña de al menos 6 caracteres" });
  try {
    const [r]: any = await pool.query("INSERT INTO users (email, name, password_hash) VALUES (?,?,?)",
      [email.toLowerCase(), name, await bcrypt.hash(password, 10)]);
    res.status(201).json({ token: token(r.insertId) });
  } catch (e: any) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Ese email ya está registrado" });
    throw e;
  }
}));

app.post("/api/auth/login", h(async (req, res) => {
  const [rows]: any = await pool.query("SELECT * FROM users WHERE email = ?", [(req.body.email ?? "").toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(req.body.password ?? "", u.password_hash)))
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  res.json({ token: token(u.id) });
}));

app.use("/api/applications", auth);

app.get("/api/applications", h(async (req, res) => {
  const { q = "", modality, experience, technology, language } = req.query as Record<string, string>;
  let sql = "SELECT * FROM applications WHERE user_id = ? AND (title LIKE ? OR company LIKE ?)";
  const p: any[] = [req.userId, `%${q}%`, `%${q}%`];
  if (modality) { sql += " AND modality = ?"; p.push(modality); }
  if (experience) { sql += " AND experience = ?"; p.push(experience); }
  if (technology) { sql += " AND technologies LIKE ?"; p.push(`%${technology}%`); }
  if (language) { sql += " AND language LIKE ?"; p.push(`%${language}%`); }
  const [rows] = await pool.query(sql + " ORDER BY updated_at DESC", p);
  res.json(rows);
}));

app.get("/api/applications/stats/monthly", h(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(applied_date, '%Y-%m') AS m, COUNT(*) AS n FROM applications
     WHERE user_id = ? AND applied_date IS NOT NULL GROUP BY m ORDER BY m`, [req.userId]);
  res.json(rows);
}));

app.post("/api/applications", h(async (req, res) => {
  const error = validate(req.body, false);
  if (error) return res.status(400).json({ error });
  const keys = FIELDS.filter((f) => req.body[f] !== undefined && req.body[f] !== "");
  const [r]: any = await pool.query(
    `INSERT INTO applications (user_id, ${keys.join(",")}) VALUES (?, ${keys.map(() => "?").join(",")})`,
    [req.userId, ...keys.map((k) => req.body[k])]);
  const [rows]: any = await pool.query("SELECT * FROM applications WHERE id = ?", [r.insertId]);
  res.status(201).json(rows[0]);
}));

app.put("/api/applications/:id", h(async (req, res) => {
  const error = validate(req.body, true);
  if (error) return res.status(400).json({ error });
  const keys = FIELDS.filter((f) => req.body[f] !== undefined);
  if (!keys.length) return res.status(400).json({ error: "Nada para actualizar" });
  const [r]: any = await pool.query(
    `UPDATE applications SET ${keys.map((k) => `${k} = ?`).join(",")} WHERE id = ? AND user_id = ?`,
    [...keys.map((k) => (req.body[k] === "" ? null : req.body[k])), req.params.id, req.userId]);
  if (!r.affectedRows) return res.status(404).json({ error: "No encontrada" });
  const [rows]: any = await pool.query("SELECT * FROM applications WHERE id = ?", [req.params.id]);
  res.json(rows[0]);
}));

app.delete("/api/applications/:id", h(async (req, res) => {
  const [r]: any = await pool.query("DELETE FROM applications WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!r.affectedRows) return res.status(404).json({ error: "No encontrada" });
  res.status(204).end();
}));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

