import { useEffect, useMemo, useState } from "react";

type Kind = "gasto" | "ingreso";
type Method = "efectivo" | "tarjeta";

type Entry = {
  id: string;
  kind: Kind;
  method: Method;
  category: string;
  amount: number;
  note: string;
  date: string;
};

type Settings = {
  sueldo: number;
  categorias: string[];
};

const CAT_EMOJI: Record<string, string> = {
  Comida: "🍽️",
  Transporte: "🚕",
  Servicios: "💡",
  Alquiler: "🏠",
  Ocio: "🎉",
  Salud: "💊",
  Ropa: "👕",
  Educación: "📚",
  Ahorro: "🐷",
  Otros: "🧾",
  Sueldo: "💼",
  Extra: "✨",
};

const STORAGE_ENTRIES = "libreta.entries.v1";
const STORAGE_SETTINGS = "libreta.settings.v1";

const DEFAULT_SETTINGS: Settings = {
  sueldo: 0,
  categorias: ["Comida", "Transporte", "Servicios", "Ocio", "Salud", "Otros"],
};

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

export default function LibretaApp() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<"inicio" | "nuevo" | "historial" | "config">("inicio");
  const [month, setMonth] = useState<string>(() => monthKey(getTodayString()));
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const e = localStorage.getItem(STORAGE_ENTRIES);
      const s = localStorage.getItem(STORAGE_SETTINGS);
      if (e) setEntries(JSON.parse(e));
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(entries));
  }, [entries, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
  }, [settings, hydrated]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const monthOptions = useMemo(() => {
    const set = new Set<string>([month]);
    entries.forEach((e) => set.add(monthKey(e.date)));
    return Array.from(set).sort().reverse();
  }, [entries, month]);

  const monthEntries = useMemo(
    () => entries.filter((e) => monthKey(e.date) === month),
    [entries, month],
  );

  const stats = useMemo(() => {
    let gastoEfectivo = 0;
    let gastoTarjeta = 0;
    let ingresosExtra = 0;
    for (const e of monthEntries) {
      if (e.kind === "gasto") {
        if (e.method === "efectivo") gastoEfectivo += e.amount;
        else gastoTarjeta += e.amount;
      } else ingresosExtra += e.amount;
    }
    const totalGastos = gastoEfectivo + gastoTarjeta;
    const disponible = settings.sueldo + ingresosExtra - totalGastos;
    const base = settings.sueldo + ingresosExtra || 1;
    const pct = Math.min(100, Math.max(0, (totalGastos / base) * 100));
    return { gastoEfectivo, gastoTarjeta, ingresosExtra, totalGastos, disponible, pct };
  }, [monthEntries, settings.sueldo]);

  return (
    <div id="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark"><span>📓</span> Libreta</div>
          <div className="month-picker">
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthOptions.map((m) => {
                const [y, mm] = m.split("-");
                return (
                  <option key={m} value={m}>
                    {MONTHS_ES[parseInt(mm, 10) - 1]} {y}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </header>

      {tab === "inicio" && <ResumenView stats={stats} sueldo={settings.sueldo} onGoConfig={() => setTab("config")} />}
      {tab === "nuevo" && (
        <NuevoView
          categorias={settings.categorias}
          onAdd={(e) => {
            setEntries((prev) => [e, ...prev]);
            setMonth(monthKey(e.date));
            showToast(e.kind === "gasto" ? "Gasto agregado" : "Ingreso agregado");
            setTab("inicio");
          }}
        />
      )}
      {tab === "historial" && (
        <HistorialView
          entries={monthEntries}
          onDelete={(id) => {
            setEntries((prev) => prev.filter((e) => e.id !== id));
            showToast("Movimiento eliminado");
          }}
        />
      )}
      {tab === "config" && (
        <ConfigView
          settings={settings}
          onChange={(s) => setSettings(s)}
          onReset={() => {
            if (confirm("¿Borrar todos los movimientos? No se puede deshacer.")) {
              setEntries([]);
              showToast("Datos borrados");
            }
          }}
          showToast={showToast}
        />
      )}

      <nav className="tabbar">
        <button className={`tab ${tab === "inicio" ? "active" : ""}`} onClick={() => setTab("inicio")}>
          <span className="tab-icon">📊</span> Inicio
        </button>
        <button className={`tab ${tab === "nuevo" ? "active" : ""}`} onClick={() => setTab("nuevo")}>
          <span className="tab-icon">➕</span> Nuevo
        </button>
        <button className={`tab ${tab === "historial" ? "active" : ""}`} onClick={() => setTab("historial")}>
          <span className="tab-icon">📜</span> Historial
        </button>
        <button className={`tab ${tab === "config" ? "active" : ""}`} onClick={() => setTab("config")}>
          <span className="tab-icon">⚙️</span> Ajustes
        </button>
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ResumenView({
  stats, sueldo, onGoConfig,
}: {
  stats: { gastoEfectivo: number; gastoTarjeta: number; ingresosExtra: number; totalGastos: number; disponible: number; pct: number };
  sueldo: number;
  onGoConfig: () => void;
}) {
  const negative = stats.disponible < 0;
  return (
    <>
      <div className="card hero">
        <div className="hero-label">Disponible del mes</div>
        <div className={`hero-value ${negative ? "negative" : ""}`}>{fmt(stats.disponible)}</div>
        <div className="hero-sub">
          Sueldo {fmt(sueldo)}
          {stats.ingresosExtra > 0 ? ` + extra ${fmt(stats.ingresosExtra)}` : ""} · gastado {fmt(stats.totalGastos)}
        </div>
        <div className="progress">
          <div className={`progress-bar ${stats.pct > 80 ? "danger" : ""}`} style={{ width: `${stats.pct}%` }} />
        </div>
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Efectivo</div>
            <div className="stat-value neg">{fmt(stats.gastoEfectivo)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Tarjeta</div>
            <div className="stat-value neg">{fmt(stats.gastoTarjeta)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Ingresos</div>
            <div className="stat-value pos">{fmt(stats.ingresosExtra)}</div>
          </div>
        </div>
      </div>

      {sueldo === 0 && (
        <div className="card">
          <p className="card-title">Empezá acá</p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
            Cargá tu sueldo en Ajustes para ver cuánto te va quedando disponible en tiempo real mientras registrás gastos.
          </p>
          <button className="btn btn-primary" onClick={onGoConfig}>Cargar sueldo</button>
        </div>
      )}
    </>
  );
}

function NuevoView({ categorias, onAdd }: { categorias: string[]; onAdd: (e: Entry) => void }) {
  const [kind, setKind] = useState<Kind>("gasto");
  const [method, setMethod] = useState<Method>("efectivo");
  const [category, setCategory] = useState(categorias[0] ?? "Otros");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => getTodayString());

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    onAdd({
      id: crypto.randomUUID(),
      kind,
      method,
      category: kind === "ingreso" ? (category === "Otros" ? "Extra" : category) : category,
      amount: n,
      note: note.trim(),
      date,
    });
    setAmount("");
    setNote("");
  };

  return (
    <div className="card">
      <p className="card-title">Nuevo movimiento</p>

      <div className="field">
        <label>Tipo</label>
        <div className="seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button className={kind === "gasto" ? "active" : ""} onClick={() => setKind("gasto")}>Gasto</button>
          <button className={kind === "ingreso" ? "active" : ""} onClick={() => setKind("ingreso")}>Ingreso</button>
        </div>
      </div>

      {kind === "gasto" && (
        <div className="field">
          <label>Método</label>
          <div className="seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <button className={method === "efectivo" ? "active" : ""} onClick={() => setMethod("efectivo")}>💵 Efectivo</button>
            <button className={method === "tarjeta" ? "active" : ""} onClick={() => setMethod("tarjeta")}>💳 Tarjeta</button>
          </div>
        </div>
      )}

      <div className="field">
        <label>Monto</label>
        <input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="row">
        <div className="field">
          <label>Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>{CAT_EMOJI[c] ?? "🧾"} {c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Nota (opcional)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalle" />
      </div>

      <button className="btn btn-primary" onClick={submit}>Guardar</button>
    </div>
  );
}

function HistorialView({ entries, onDelete }: { entries: Entry[]; onDelete: (id: string) => void }) {
  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  const formatDateLabel = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    if (!y || !m || !d) return dateStr;
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="card">
      <p className="card-title">Historial del mes</p>
      {sorted.length === 0 && <div className="empty">Sin movimientos todavía.</div>}
      {sorted.map((e) => (
        <div className="hist-row" key={e.id}>
          <div className="hist-emoji">{CAT_EMOJI[e.category] ?? "🧾"}</div>
          <div className="hist-info">
            <div className="hist-title">{e.category}{e.note ? ` · ${e.note}` : ""}</div>
            <div className="hist-meta">
              {formatDateLabel(e.date)} · {e.kind === "gasto" ? (e.method === "efectivo" ? "Efectivo" : "Tarjeta") : "Ingreso"}
            </div>
          </div>
          <div className={`hist-amount ${e.kind === "ingreso" ? "pos" : "neg"}`}>
            {e.kind === "ingreso" ? "+" : "−"}{fmt(e.amount)}
          </div>
          <button className="hist-del" onClick={() => onDelete(e.id)} aria-label="Eliminar">✕</button>
        </div>
      ))}
    </div>
  );
}

function ConfigView({
  settings, onChange, onReset, showToast,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onReset: () => void;
  showToast: (m: string) => void;
}) {
  const [newCat, setNewCat] = useState("");

  const updateSueldo = (val: string) => {
    const n = parseFloat(val) || 0;
    onChange({ ...settings, sueldo: n });
  };

  return (
    <>
      <div className="card">
        <p className="card-title">Sueldo mensual</p>
        <div className="field">
          <label>Monto de tu sueldo</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={settings.sueldo || ""}
            onChange={(e) => updateSueldo(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <p className="card-title">Categorías</p>
        <div className="cat-chips">
          {settings.categorias.map((c) => (
            <div className="cat-chip" key={c}>
              {CAT_EMOJI[c] ?? "🧾"} {c}
              <button onClick={() => onChange({ ...settings, categorias: settings.categorias.filter((x) => x !== c) })}>✕</button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <input type="text" placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          </div>
          <button
            className="btn btn-ghost"
            style={{ flex: "0 0 auto", width: "auto", padding: "12px 18px" }}
            onClick={() => {
              const v = newCat.trim();
              if (!v || settings.categorias.includes(v)) return;
              onChange({ ...settings, categorias: [...settings.categorias, v] });
              setNewCat("");
              showToast("Categoría agregada");
            }}
          >
            Añadir
          </button>
        </div>
      </div>

      <div className="card">
        <p className="card-title">Datos</p>
        <button className="btn btn-danger" onClick={onReset}>Borrar todos los movimientos</button>
      </div>
    </>
  );
}
