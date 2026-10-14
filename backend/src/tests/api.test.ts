import request from "supertest";
import { app, pool } from "../app";

const password = "secreto123";
const authed = (t: string) => ({ Authorization: `Bearer ${t}` });
const email = () => `t${Date.now()}${Math.random().toString(36).slice(2, 7)}@test.com`;

async function newUser() {
  const e = email();
  const res = await request(app).post("/api/auth/register").send({ email: e, password });
  return { email: e, token: res.body.token as string };
}
const create = (token: string, body: object) => request(app).post("/api/applications").set(authed(token)).send(body);

afterAll(() => pool.end());

describe("autenticación", () => {
  it("registra un usuario y devuelve un token", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: email(), password });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
  });

  it("rechaza un email ya registrado", async () => {
    const u = await newUser();
    const res = await request(app).post("/api/auth/register").send({ email: u.email, password });
    expect(res.status).toBe(409);
  });

  it("rechaza contraseñas de menos de 6 caracteres", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: email(), password: "123" });
    expect(res.status).toBe(400);
  });

  it("inicia sesión con credenciales correctas", async () => {
    const u = await newUser();
    const res = await request(app).post("/api/auth/login").send({ email: u.email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("rechaza una contraseña incorrecta", async () => {
    const u = await newUser();
    const res = await request(app).post("/api/auth/login").send({ email: u.email, password: "incorrecta" });
    expect(res.status).toBe(401);
  });
});

describe("postulaciones", () => {
  it("exige token", async () => {
    expect((await request(app).get("/api/applications")).status).toBe(401);
    expect((await request(app).get("/api/applications").set(authed("falso"))).status).toBe(401);
  });

  it("valida campos obligatorios y valores permitidos", async () => {
    const { token } = await newUser();
    expect((await create(token, { title: "Dev" })).status).toBe(400);
    expect((await create(token, { title: "Dev", company: "Acme", modality: "volando" })).status).toBe(400);
  });

  it("crea, actualiza, lista y elimina", async () => {
    const { token } = await newUser();
    const created = await create(token, { title: "Dev", company: "Acme", technologies: "React" });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("wishlist");

    const id = created.body.id;
    const updated = await request(app).put(`/api/applications/${id}`).set(authed(token)).send({ status: "interview" });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe("interview");

    const list = await request(app).get("/api/applications").set(authed(token));
    expect(list.body).toHaveLength(1);

    expect((await request(app).delete(`/api/applications/${id}`).set(authed(token))).status).toBe(204);
    expect((await request(app).delete(`/api/applications/${id}`).set(authed(token))).status).toBe(404);
  });

  it("filtra por modalidad, tecnología y texto", async () => {
    const { token } = await newUser();
    await create(token, { title: "Frontend", company: "Acme", modality: "remote", technologies: "React, TypeScript" });
    await create(token, { title: "Backend", company: "Globex", modality: "onsite", technologies: "Java" });
    const get = (qs: string) => request(app).get(`/api/applications?${qs}`).set(authed(token));

    expect((await get("modality=onsite")).body).toHaveLength(1);
    expect((await get("technology=react")).body[0].company).toBe("Acme");
    expect((await get("q=glob")).body[0].title).toBe("Backend");
  });

  it("aísla los datos entre usuarios", async () => {
    const a = await newUser();
    const b = await newUser();
    const { body } = await create(a.token, { title: "Dev", company: "Acme" });

    expect((await request(app).get("/api/applications").set(authed(b.token))).body).toHaveLength(0);
    expect((await request(app).put(`/api/applications/${body.id}`).set(authed(b.token)).send({ status: "offer" })).status).toBe(404);
    expect((await request(app).delete(`/api/applications/${body.id}`).set(authed(b.token))).status).toBe(404);
  });

  it("agrupa las postulaciones por mes", async () => {
    const { token } = await newUser();
    await create(token, { title: "A", company: "X", applied_date: "2026-03-10" });
    await create(token, { title: "B", company: "Y", applied_date: "2026-03-20" });
    await create(token, { title: "C", company: "Z", applied_date: "2026-04-01" });

    const res = await request(app).get("/api/applications/stats/monthly").set(authed(token));
    expect(res.body).toEqual([{ m: "2026-03", n: 2 }, { m: "2026-04", n: 1 }]);
  });
});
