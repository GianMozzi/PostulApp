import { useEffect, useMemo, useState, DragEvent, FormEvent } from "react";
import { api, Application, Draft, Filters, LABELS, Status, STATUSES, tok } from "./api";

const MODALITY = { remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" };
const LEVEL = { junior: "Junior", semi: "Semi senior", senior: "Senior" };
const PRIORITY = { low: "Baja", medium: "Media", high: "Alta" };

function Board({ onLogout }: { onLogout: () => void }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [f, setF] = useState<Filters>({});
  const [monthly, setMonthly] = useState<{ m: string; n: number }[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState("");

  const load = () => { api.list(f).then(setApps).catch((e) => setError(e.message)); api.monthly().then(setMonthly).catch(() => {}); };
  const fs = (k: keyof Filters) => ({ value: f[k] ?? "", onChange: (e: any) => setF({ ...f, [k]: e.target.value }) });
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [f]);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return apps.filter((a) => a.interview_date && a.interview_date >= today)
      .sort((a, b) => a.interview_date!.localeCompare(b.interview_date!)).slice(0, 5);
  }, [apps]);

  const stats = useMemo(() => {
    const sent = apps.filter((a) => a.status !== "wishlist");
    const replied = sent.filter((a) => ["interview", "technical", "offer", "rejected"].includes(a.status));
    return {
      sent: sent.length,
      rate: sent.length ? Math.round((replied.length / sent.length) * 100) : 0,
      interviews: apps.filter((a) => a.status === "interview" || a.status === "technical").length,
      offers: apps.filter((a) => a.status === "offer").length,
    };
  }, [apps]);

  const move = async (id: number, status: Status) => {
    setApps((p) => p.map((a) => (a.id === id ? { ...a, status } : a)));
    try { await api.update(id, { status }); } catch (e: any) { setError(e.message); load(); }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      editing!.id ? await api.update(editing!.id, editing!) : await api.create(editing!);
      setEditing(null); setError(""); load();
    } catch (err: any) { setError(err.message); }
  };

  const remove = async () => { await api.remove(editing!.id!); setEditing(null); load(); };
  const set = (k: keyof Application, v: string) => setEditing({ ...editing!, [k]: v });

  return (
    <div className="app">
      <header>
        <div><h1>PostulApp</h1><p>Arrastrá las tarjetas para cambiar el estado de cada postulación.</p></div>
        <div className="actions"><button onClick={onLogout}>Cerrar sesión</button><button className="primary" onClick={() => setEditing({ status: "wishlist", modality: "remote", priority: "medium" })}>Nueva postulación</button></div>
      </header>

      <section className="stats">
        <div><b>{stats.sent}</b>postulaciones enviadas</div>
        <div><b>{stats.rate}%</b>tasa de respuesta</div>
        <div><b>{stats.interviews}</b>entrevistas activas</div>
        <div><b>{stats.offers}</b>ofertas</div>
      </section>

      <section className="insights">
        <div><h3>Postulaciones por mes</h3>
          {monthly.length === 0 ? <p className="empty">Cargá fechas de postulación para ver la evolución</p> :
            <div className="bars">{monthly.slice(-6).map((x) => (
              <div key={x.m} title={`${x.m}: ${x.n}`}><i style={{ height: Math.min(80, 8 + x.n * 14) }} /><span>{x.m.slice(5)}/{x.m.slice(2, 4)}</span></div>))}</div>}
        </div>
        <div><h3>Próximas entrevistas</h3>
          {upcoming.length === 0 ? <p className="empty">Sin entrevistas agendadas</p> :
            <ul>{upcoming.map((a) => <li key={a.id}><b>{a.interview_date}</b> {a.company}{a.contact ? `, ${a.contact}` : ""}</li>)}</ul>}
        </div>
      </section>

      <div className="filters">
        <input className="search" placeholder="Buscar por puesto o empresa" {...fs("q")} />
        <select {...fs("modality")}><option value="">Toda modalidad</option>{Object.entries(MODALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select {...fs("experience")}><option value="">Todo nivel</option>{Object.entries(LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className="search" placeholder="Tecnología" {...fs("technology")} />
        <input className="search" placeholder="Idioma" {...fs("language")} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <main className="board">
        {STATUSES.map((s) => {
          const items = apps.filter((a) => a.status === s);
          return (
            <section key={s} className={`col ${s}`} onDragOver={(e) => e.preventDefault()}
              onDrop={(e: DragEvent) => move(Number(e.dataTransfer.getData("id")), s)}>
              <h2>{LABELS[s]} <span>{items.length}</span></h2>
              {items.length === 0 && <p className="empty">Soltá una tarjeta acá</p>}
              {items.map((a) => (
                <article key={a.id} className="card" draggable tabIndex={0}
                  onDragStart={(e) => e.dataTransfer.setData("id", String(a.id))}
                  onClick={() => setEditing(a)} onKeyDown={(e) => e.key === "Enter" && setEditing(a)}>
                  <div className="row"><strong>{a.title}</strong><em className={a.priority}>{PRIORITY[a.priority]}</em></div>
                  <span className="company">{a.company}</span>
                  {a.technologies && <small>{a.technologies}</small>}{a.next_step && <small>Próximo paso: {a.next_step}</small>}
                  <small>{MODALITY[a.modality]}{a.location ? `, ${a.location}` : ""}{a.applied_date ? `, ${a.applied_date}` : ""}</small>
                  {a.notes && <p>{a.notes}</p>}
                </article>
              ))}
            </section>
          );
        })}
      </main>

      {editing && (
        <div className="overlay" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? "Editar postulación" : "Nueva postulación"}</h2>
            <label>Puesto<input required value={editing.title ?? ""} onChange={(e) => set("title", e.target.value)} /></label>
            <label>Empresa<input required value={editing.company ?? ""} onChange={(e) => set("company", e.target.value)} /></label>
            <label>Ubicación<input value={editing.location ?? ""} onChange={(e) => set("location", e.target.value)} /></label>
            <div className="grid">
              <label>Modalidad<select value={editing.modality} onChange={(e) => set("modality", e.target.value)}>
                {Object.entries(MODALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Prioridad<select value={editing.priority} onChange={(e) => set("priority", e.target.value)}>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Estado<select value={editing.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}</select></label>
              <label>Fecha<input type="date" value={editing.applied_date ?? ""} onChange={(e) => set("applied_date", e.target.value)} /></label>
            </div>
            <div className="grid">
              <label>Nivel<select value={editing.experience ?? ""} onChange={(e) => set("experience", e.target.value)}><option value="">Sin definir</option>
                {Object.entries(LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Idioma requerido<input value={editing.language ?? ""} onChange={(e) => set("language", e.target.value)} /></label>
              <label>Fecha de entrevista<input type="date" value={editing.interview_date ?? ""} onChange={(e) => set("interview_date", e.target.value)} /></label>
              <label>Contacto<input value={editing.contact ?? ""} onChange={(e) => set("contact", e.target.value)} /></label>
            </div>
            <label>Tecnologías (separadas por coma)<input value={editing.technologies ?? ""} onChange={(e) => set("technologies", e.target.value)} /></label>
            <label>Próximo paso<input value={editing.next_step ?? ""} onChange={(e) => set("next_step", e.target.value)} /></label>
            <label>Notas<textarea rows={3} value={editing.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></label>
            <div className="actions">
              {editing.id && <button type="button" className="danger" onClick={remove}>Eliminar</button>}
              <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="primary">Guardar cambios</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [reg, setReg] = useState(false);
  const [v, setV] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { reg ? await api.register(v.name, v.email, v.password) : await api.login(v.email, v.password); onDone(); }
    catch (x: any) { setErr(x.message); }
  };
  return (
    <div className="overlay" style={{ background: "var(--bg)" }}>
      <form onSubmit={submit}>
        <h2>{reg ? "Crear cuenta" : "Iniciar sesión"}</h2>
        {reg && <label>Nombre<input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>}
        <label>Email<input type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
        <label>Contraseña<input type="password" required minLength={6} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="primary">{reg ? "Crear cuenta" : "Entrar"}</button>
        <button type="button" onClick={() => { setReg(!reg); setErr(""); }}>{reg ? "Ya tengo cuenta" : "No tengo cuenta"}</button>
      </form>
    </div>
  );
}

export default function App() {
  const [logged, setLogged] = useState(!!tok.get());
  return logged ? <Board onLogout={() => { tok.clear(); setLogged(false); }} /> : <Login onDone={() => setLogged(true)} />;
}
