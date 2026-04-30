import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Plus, ThumbsUp, Trash2, Check,
  ChevronDown, ChevronUp, Download, Zap, Send,
  MessageSquare, Filter, Loader2, Home, Package,
  AlertTriangle, Bot, User, Search, ArrowLeft, Bell,
  ShoppingCart, RefreshCw, Wifi, Battery, Signal, Smartphone
} from "lucide-react";

/* ─────────────────────────────────────── CSS animations ───── */
const PHONE_CSS = `
@keyframes antenna-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes eye-blink{0%,88%,100%{transform:scaleY(1)}92%{transform:scaleY(0.08)}}
@keyframes robot-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes splash-fade{0%{opacity:0;transform:scale(0.8)}100%{opacity:1;transform:scale(1)}}
@keyframes slide-in-right{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes slide-in-left{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes slide-up-in{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes pulse-live{0%,100%{opacity:1}50%{opacity:0.3}}
.ani-robot-float{animation:robot-float 3s ease-in-out infinite}
.ani-robot-eye{animation:eye-blink 4s ease-in-out infinite;display:block;transform-origin:center}
.ani-antenna{animation:antenna-bounce 2s ease-in-out infinite}
.ani-splash{animation:splash-fade .5s ease forwards}
.ani-slide-right{animation:slide-in-right .28s ease forwards}
.ani-slide-left{animation:slide-in-left .28s ease forwards}
.ani-slide-up{animation:slide-up-in .3s ease forwards}
.ani-pulse{animation:pulse-live 1.5s ease-in-out infinite}
`;

/* ─────────────────────────────────────── Helpers ────────────── */
const fmt = (n) => n != null ? Number(n).toLocaleString("es-AR") : "—";
const fmtMoney = (n) => n != null ? `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}` : "—";

/* ─────────────────────────────────────── Robot ──────────────── */
function Robot({ size = 72 }) {
  const s = size;
  return (
    <div className="ani-robot-float" style={{ width: s, margin: "0 auto" }}>
      {/* Antena */}
      <div className="ani-antenna" style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:-2 }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#3DDC84", boxShadow:"0 0 10px #3DDC84" }}/>
        <div style={{ width:2, height:s*0.14, background:"#888" }}/>
      </div>
      {/* Cabeza */}
      <div style={{
        width:s*0.72, height:s*0.46, background:"#3DDC84", borderRadius:s*0.1,
        display:"flex", alignItems:"center", justifyContent:"center", gap:s*0.09,
        boxShadow:"0 6px 24px rgba(61,220,132,0.5)", margin:"0 auto"
      }}>
        {[0,1].map(i => (
          <div key={i} style={{ width:s*0.15, height:s*0.15, background:"white", borderRadius:"50%",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div className="ani-robot-eye" style={{ width:s*0.08, height:s*0.1, background:"#1a1a2e", borderRadius:"50%" }}/>
          </div>
        ))}
      </div>
      {/* Cuerpo */}
      <div style={{
        width:s*0.88, height:s*0.44, background:"#2d9c5e", borderRadius:s*0.07, marginTop:3,
        display:"flex", alignItems:"center", justifyContent:"center", gap:s*0.07, margin:"3px auto 0"
      }}>
        {["#3DDC84","white","#3DDC84"].map((c,i) => (
          <div key={i} style={{ width:s*0.1, height:s*0.1, borderRadius:"50%", background:c, opacity:0.9 }}/>
        ))}
      </div>
      {/* Piernas */}
      <div style={{ display:"flex", gap:s*0.16, marginTop:3, justifyContent:"center" }}>
        {[0,1].map(i => (
          <div key={i} style={{ width:s*0.16, height:s*0.18, background:"#2d9c5e", borderRadius:s*0.05 }}/>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── StatusBar ─────────── */
function StatusBar() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" }));
  useEffect(() => { const id = setInterval(() => setT(new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})),30000); return () => clearInterval(id); },[]);
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"4px 14px 2px", color:"white" }}>
      <span style={{ fontSize:10, fontWeight:800 }}>{t}</span>
      <div style={{ display:"flex", gap:4, alignItems:"center" }}>
        <Signal size={10}/><Wifi size={10}/><Battery size={11}/>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── Header ─────────────── */
function Header({ title, onBack, right }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"7px 12px", background:"rgba(30,58,138,0.96)", color:"white" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {onBack && <button onClick={onBack} style={{ background:"none",border:"none",color:"white",cursor:"pointer",padding:0,display:"flex" }}><ArrowLeft size={15}/></button>}
        <span style={{ fontSize:12, fontWeight:700 }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

/* ─────────────────────────────────────── SCREENS ─────────────── */

// ── Splash ──
function SplashScreen({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="ani-splash" style={{ height:"100%", background:"linear-gradient(160deg,#0f172a,#1e3a8a,#0f172a)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20 }}>
      <Robot size={88}/>
      <div style={{ textAlign:"center", color:"white" }}>
        <div style={{ fontSize:16, fontWeight:900, letterSpacing:1 }}>ERP Mundo Outdoor</div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:4 }}>Aplicación Móvil</div>
      </div>
      <div style={{ marginTop:8, display:"flex", gap:6 }}>
        {[0,1,2].map(i => (
          <div key={i} className="ani-pulse" style={{ width:6, height:6, borderRadius:"50%",
            background:"#3DDC84", animationDelay:`${i*0.3}s` }}/>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ──
function DashboardScreen({ navigate }) {
  const { data: ventas } = useQuery({ queryKey:["widget","ventas_hoy"],
    queryFn: () => api.get("/dashboard/widget/ventas_hoy"), staleTime:60000 });
  const { data: stock } = useQuery({ queryKey:["widget","resumen_stock"],
    queryFn: () => api.get("/dashboard/widget/resumen_stock"), staleTime:60000 });
  const { data: pedidos } = useQuery({ queryKey:["widget","pedidos_activos"],
    queryFn: () => api.get("/dashboard/widget/pedidos_activos"), staleTime:60000 });
  const { data: alertas } = useQuery({ queryKey:["widget","alertas_stock"],
    queryFn: () => api.get("/dashboard/widget/alertas_stock"), staleTime:60000 });

  const cards = [
    { label:"Ventas hoy",  value: fmtMoney(ventas?.monto_total), sub:`${ventas?.total_ventas??0} transacc.`, color:"#3b82f6", icon:"💰" },
    { label:"Unidades",    value: fmt(stock?.total_unidades),    sub:`${stock?.total_productos??0} productos`, color:"#8b5cf6", icon:"📦" },
    { label:"Pedidos act.",value: fmt(pedidos?.pedidos?.length), sub:"en curso",  color:"#f59e0b", icon:"🛒" },
    { label:"Alertas",     value: fmt(alertas?.alertas?.length), sub:"stock bajo", color:"#ef4444", icon:"⚠️" },
  ];

  const quickActions = [
    { label:"Ingreso",  icon:"📥", screen:"ingreso" },
    { label:"Stock",    icon:"📦", screen:"stock" },
    { label:"Pedidos",  icon:"🛒", screen:"pedidos" },
    { label:"Alertas",  icon:"🔔", screen:"alertas" },
    { label:"Nexus IA", icon:"🤖", screen:"nexus" },
    { label:"Perfil",   icon:"👤", screen:"perfil" },
  ];

  return (
    <div style={{ height:"100%", overflowY:"auto", background:"#f1f5f9" }}>
      <div style={{ background:"linear-gradient(135deg,#1e3a8a,#2563eb)", padding:"12px 12px 20px", color:"white" }}>
        <div style={{ fontSize:10, opacity:0.7, marginBottom:2 }}>Buenos días,</div>
        <div style={{ fontSize:14, fontWeight:800 }}>🏔️ Mundo Outdoor</div>
        <div style={{ fontSize:9, opacity:0.6, marginTop:2 }}>
          {new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}
        </div>
      </div>

      {/* Stats cards 2x2 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, padding:"10px 8px 6px", marginTop:-10 }}>
        {cards.map((c,i) => (
          <div key={i} className="ani-slide-up" style={{ background:"white", borderRadius:12, padding:"8px 10px",
            boxShadow:"0 2px 8px rgba(0,0,0,0.08)", animationDelay:`${i*0.06}s` }}>
            <div style={{ fontSize:16 }}>{c.icon}</div>
            <div style={{ fontSize:15, fontWeight:900, color:c.color, marginTop:2 }}>{c.value}</div>
            <div style={{ fontSize:9, fontWeight:700, color:"#374151" }}>{c.label}</div>
            <div style={{ fontSize:8, color:"#9ca3af" }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ padding:"0 8px" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#374151", marginBottom:6, marginTop:4 }}>Accesos rápidos</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
          {quickActions.map((a,i) => (
            <button key={i} onClick={() => navigate(a.screen)}
              style={{ background:"white", border:"none", borderRadius:12, padding:"8px 4px",
                boxShadow:"0 2px 6px rgba(0,0,0,0.06)", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:18 }}>{a.icon}</div>
              <div style={{ fontSize:9, color:"#374151", fontWeight:600, marginTop:2 }}>{a.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent pedidos */}
      {pedidos?.pedidos?.length > 0 && (
        <div style={{ padding:"8px 8px 12px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#374151", marginBottom:5 }}>Pedidos activos</div>
          {pedidos.pedidos.slice(0,3).map((p,i) => (
            <div key={i} style={{ background:"white", borderRadius:10, padding:"7px 10px", marginBottom:4,
              display:"flex", justifyContent:"space-between", alignItems:"center",
              boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"#111" }}>{p.proveedor || "Proveedor"}</div>
                <div style={{ fontSize:8, color:"#6b7280" }}>#{p.order_number || p.id}</div>
              </div>
              <span style={{ fontSize:8, background:"#dbeafe", color:"#1d4ed8",
                padding:"2px 6px", borderRadius:20, fontWeight:600 }}>{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stock ──
function StockScreen({ navigate }) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery({
    queryKey:["phone-stock", q],
    queryFn: () => api.get(`/stock?search=${encodeURIComponent(q)}&limit=10`),
    staleTime:30000
  });
  const items = data?.items || [];
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#f8fafc" }}>
      <Header title="Stock" onBack={() => navigate("home")}
        right={isFetching ? <Loader2 size={13} className="animate-spin" color="white"/> : null}/>
      <div style={{ padding:"8px 8px 4px", background:"white", borderBottom:"1px solid #e5e7eb" }}>
        <div style={{ display:"flex", gap:6, alignItems:"center",
          background:"#f1f5f9", borderRadius:10, padding:"5px 10px" }}>
          <Search size={12} color="#9ca3af"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key==="Enter" && setQ(search)}
            placeholder="Buscar producto, SKU..."
            style={{ border:"none", background:"transparent", outline:"none",
              fontSize:11, color:"#374151", flex:1 }}/>
          {search && <button onClick={() => { setSearch(""); setQ(""); }}
            style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", padding:0 }}>
            <Check size={11}/>
          </button>}
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {items.length === 0 && !isFetching && (
          <div style={{ textAlign:"center", padding:"30px 0", color:"#9ca3af", fontSize:11 }}>
            {q ? "Sin resultados" : "Ingresá un término para buscar"}
          </div>
        )}
        {items.map((it,i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"8px 12px", borderBottom:"1px solid #f1f5f9", background:"white",
            marginBottom:1 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#111", whiteSpace:"nowrap",
                overflow:"hidden", textOverflow:"ellipsis" }}>{it.product_name}</div>
              <div style={{ fontSize:9, color:"#9ca3af" }}>{it.sku} · {it.size} {it.color}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:900,
                color: it.stock <= 0 ? "#ef4444" : it.stock <= 3 ? "#f59e0b" : "#16a34a" }}>
                {it.stock}
              </div>
              <div style={{ fontSize:8, color:"#9ca3af" }}>unid.</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Alertas ──
function AlertasScreen({ navigate }) {
  const { data, isLoading } = useQuery({
    queryKey:["widget","alertas_stock"],
    queryFn: () => api.get("/dashboard/widget/alertas_stock"), staleTime:60000
  });
  const alertas = data?.alertas || [];
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#f8fafc" }}>
      <Header title="⚠️ Alertas Stock" onBack={() => navigate("home")}/>
      <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
        {isLoading && <div style={{ textAlign:"center", padding:"30px 0", color:"#9ca3af", fontSize:11 }}>Cargando...</div>}
        {!isLoading && alertas.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div style={{ fontSize:28 }}>✅</div>
            <div style={{ fontSize:11, color:"#16a34a", fontWeight:700, marginTop:6 }}>¡Todo bien!</div>
            <div style={{ fontSize:9, color:"#9ca3af", marginTop:2 }}>Sin alertas de stock</div>
          </div>
        )}
        {alertas.map((a,i) => (
          <div key={i} style={{ background:"white", borderRadius:10, padding:"8px 10px", marginBottom:5,
            borderLeft:"3px solid " + (a.stock===0?"#ef4444":"#f59e0b"),
            boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:10, fontWeight:700, color:"#111", flex:1,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.producto}</span>
              <span style={{ fontSize:13, fontWeight:900,
                color: a.stock===0?"#ef4444":"#f59e0b", flexShrink:0, marginLeft:6 }}>
                {a.stock} u
              </span>
            </div>
            <div style={{ fontSize:8, color:"#9ca3af", marginTop:1 }}>
              {a.sku} · T:{a.size} C:{a.color}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pedidos ──
function PedidosScreen({ navigate }) {
  const { data, isLoading } = useQuery({
    queryKey:["widget","pedidos_activos"],
    queryFn: () => api.get("/dashboard/widget/pedidos_activos"), staleTime:60000
  });
  const pedidos = data?.pedidos || [];
  const statusColor = { BORRADOR:"#9ca3af", ENVIADO:"#3b82f6", RECIBIDO:"#16a34a", ANULADO:"#ef4444" };
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#f8fafc" }}>
      <Header title="Pedidos" onBack={() => navigate("home")}/>
      <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
        {isLoading && <div style={{ textAlign:"center", padding:"30px 0", color:"#9ca3af", fontSize:11 }}>Cargando...</div>}
        {!isLoading && pedidos.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", fontSize:11, color:"#9ca3af" }}>Sin pedidos activos</div>
        )}
        {pedidos.map((p,i) => (
          <div key={i} style={{ background:"white", borderRadius:12, padding:"9px 11px", marginBottom:5,
            boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#111", whiteSpace:"nowrap",
                  overflow:"hidden", textOverflow:"ellipsis" }}>{p.proveedor || "Proveedor"}</div>
                <div style={{ fontSize:9, color:"#6b7280", marginTop:1 }}>
                  #{p.order_number || p.id} · {p.created_at ? new Date(p.created_at).toLocaleDateString("es-AR") : ""}
                </div>
              </div>
              <span style={{ fontSize:8, fontWeight:700, padding:"2px 7px", borderRadius:20,
                background:(statusColor[p.status]||"#9ca3af")+"22",
                color:statusColor[p.status]||"#9ca3af", flexShrink:0 }}>{p.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Nexus IA ──
function NexusScreen({ navigate }) {
  const [msgs, setMsgs] = useState([
    { role:"assistant", text:"¡Hola! Soy Nexus IA 🤖 ¿En qué te ayudo?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMsgs(m => [...m, { role:"user", text:msg }]);
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/v1/asistente/chat", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${token}` },
        body: JSON.stringify({ message:msg, history: msgs.slice(-4).map(m=>({role:m.role,content:m.text})) })
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      setMsgs(m => [...m, { role:"assistant", text:"..." }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === "text_delta") {
                full += ev.content;
                setMsgs(m => { const a = [...m]; a[a.length-1] = { role:"assistant", text:full }; return a; });
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      setMsgs(m => { const a=[...m]; a[a.length-1]={ role:"assistant", text:"Error al conectar con Nexus." }; return a; });
    }
    setLoading(false);
  }, [input, msgs, loading]);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#f8fafc" }}>
      <Header title="🤖 Nexus IA" onBack={() => navigate("home")}/>
      {/* Mensajes */}
      <div style={{ flex:1, overflowY:"auto", padding:"8px 8px 4px" }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start",
            marginBottom:6 }}>
            <div style={{
              maxWidth:"80%", padding:"7px 10px", borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",
              background:m.role==="user"?"#2563eb":"white",
              color:m.role==="user"?"white":"#111",
              fontSize:10, lineHeight:1.5, boxShadow:"0 1px 4px rgba(0,0,0,0.08)"
            }}>
              {m.text === "..." ? <Loader2 size={12} className="animate-spin"/> : m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      {/* Input */}
      <div style={{ padding:"6px 8px", background:"white", borderTop:"1px solid #e5e7eb",
        display:"flex", gap:6, alignItems:"center" }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==="Enter" && send()}
          placeholder="Preguntá algo al ERP..."
          style={{ flex:1, border:"1px solid #e5e7eb", borderRadius:20, padding:"5px 10px",
            fontSize:10, outline:"none", color:"#374151" }}/>
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ width:28, height:28, borderRadius:"50%", background:"#2563eb", border:"none",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            opacity: (!input.trim()||loading) ? 0.4 : 1 }}>
          <Send size={12} color="white"/>
        </button>
      </div>
    </div>
  );
}

// ── Perfil ──
function PerfilScreen({ navigate }) {
  const { data: me } = useQuery({ queryKey:["me"], queryFn:()=>api.get("/auth/me"), staleTime:60000 });
  const items = [
    { icon:"👤", label:"Nombre", value:me?.full_name||"—" },
    { icon:"📧", label:"Usuario", value:me?.username||"—" },
    { icon:"🔑", label:"Rol", value:me?.role||"—" },
    { icon:"🏢", label:"Empresa", value:me?.company_name||"Mundo Outdoor" },
  ];
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#f8fafc" }}>
      <Header title="Mi Perfil" onBack={() => navigate("home")}/>
      {/* Avatar */}
      <div style={{ background:"linear-gradient(135deg,#1e3a8a,#2563eb)", padding:"20px 0",
        display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
        <div style={{ width:52, height:52, borderRadius:"50%", background:"rgba(255,255,255,0.2)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
          {me?.full_name?.charAt(0)?.toUpperCase() || "U"}
        </div>
        <div style={{ color:"white", fontSize:13, fontWeight:800 }}>{me?.full_name||"Usuario"}</div>
        <div style={{ color:"rgba(255,255,255,0.6)", fontSize:9 }}>{me?.role||""}</div>
      </div>
      {/* Info */}
      <div style={{ padding:"8px" }}>
        {items.map((it,i) => (
          <div key={i} style={{ background:"white", borderRadius:10, padding:"8px 12px",
            marginBottom:4, display:"flex", alignItems:"center", gap:10,
            boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize:14 }}>{it.icon}</span>
            <div>
              <div style={{ fontSize:8, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5 }}>{it.label}</div>
              <div style={{ fontSize:11, fontWeight:700, color:"#111" }}>{it.value}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop:8, textAlign:"center", fontSize:9, color:"#9ca3af" }}>
          ERP Mundo Outdoor · App Móvil v1.0
        </div>
      </div>
    </div>
  );
}

// ── Ingreso Rápido ──
function IngresoScreen({ navigate }) {
  const { data, isLoading } = useQuery({
    queryKey:["widget","ingresos_recientes"],
    queryFn: () => api.get("/dashboard/widget/ingresos_recientes"), staleTime:60000
  });
  const ingresos = data?.ingresos || [];
  const statusColor = { BORRADOR:"#9ca3af", CONFIRMADO:"#16a34a", ANULADO:"#ef4444" };
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#f8fafc" }}>
      <Header title="📥 Ingresos" onBack={() => navigate("home")}/>
      <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
        {isLoading && <div style={{ textAlign:"center", padding:"30px 0", color:"#9ca3af", fontSize:11 }}>Cargando...</div>}
        {!isLoading && ingresos.length === 0 && (
          <div style={{ textAlign:"center", padding:"30px 0", fontSize:11, color:"#9ca3af" }}>Sin ingresos recientes</div>
        )}
        {ingresos.map((ing,i) => (
          <div key={i} style={{ background:"white", borderRadius:12, padding:"9px 11px", marginBottom:5,
            boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#111", whiteSpace:"nowrap",
                  overflow:"hidden", textOverflow:"ellipsis" }}>{ing.proveedor||"Proveedor"}</div>
                <div style={{ fontSize:9, color:"#6b7280", marginTop:1 }}>
                  {ing.remito_number || `#${ing.id}`} · {ing.created_at ? new Date(ing.created_at).toLocaleDateString("es-AR") : ""}
                </div>
              </div>
              <span style={{ fontSize:8, fontWeight:700, padding:"2px 7px", borderRadius:20,
                background:(statusColor[ing.status]||"#9ca3af")+"22",
                color:statusColor[ing.status]||"#9ca3af", flexShrink:0 }}>{ing.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── Bottom Nav ─────────── */
const BOTTOM_TABS = [
  { id:"home",    icon:Home,      label:"Inicio" },
  { id:"stock",   icon:Package,   label:"Stock" },
  { id:"pedidos", icon:ShoppingCart, label:"Pedidos" },
  { id:"nexus",   icon:Bot,       label:"Nexus" },
  { id:"perfil",  icon:User,      label:"Perfil" },
];

function BottomNav({ screen, navigate }) {
  return (
    <div style={{ display:"flex", background:"white", borderTop:"1px solid #e5e7eb", flexShrink:0 }}>
      {BOTTOM_TABS.map(tab => {
        const Icon = tab.icon;
        const active = screen === tab.id || (screen === "home" && tab.id === "home");
        return (
          <button key={tab.id} onClick={() => navigate(tab.id)}
            style={{ flex:1, border:"none", background:"none", cursor:"pointer",
              padding:"6px 0 5px", display:"flex", flexDirection:"column",
              alignItems:"center", gap:2 }}>
            <Icon size={16} color={active ? "#2563eb" : "#9ca3af"}/>
            <span style={{ fontSize:8, color: active ? "#2563eb" : "#9ca3af",
              fontWeight: active ? 700 : 400 }}>{tab.label}</span>
            {active && <div style={{ width:16, height:2, background:"#2563eb", borderRadius:1, marginTop:-1 }}/>}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────── Phone Simulator ─────── */
function PhoneSimulator({ fullscreen, onToggleFullscreen }) {
  const [screen, setScreen] = useState("splash");
  const [anim, setAnim] = useState("ani-splash");
  const [displayScreen, setDisplayScreen] = useState("splash");

  const navigate = useCallback((to) => {
    setAnim("ani-slide-right");
    setScreen(to);
    setTimeout(() => setDisplayScreen(to), 0);
  }, []);

  const SHOW_BOTTOM = !["splash","nexus"].includes(displayScreen) ||
    ["stock","pedidos","perfil","alertas","ingreso"].includes(displayScreen);

  const screenMap = {
    splash:  <SplashScreen onDone={() => navigate("home")}/>,
    home:    <DashboardScreen navigate={navigate}/>,
    stock:   <StockScreen navigate={navigate}/>,
    alertas: <AlertasScreen navigate={navigate}/>,
    pedidos: <PedidosScreen navigate={navigate}/>,
    nexus:   <NexusScreen navigate={navigate}/>,
    perfil:  <PerfilScreen navigate={navigate}/>,
    ingreso: <IngresoScreen navigate={navigate}/>,
  };

  const W = fullscreen ? 340 : 260;
  const H = fullscreen ? 680 : 520;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      {/* Phone frame */}
      <div style={{
        width: W + 24, height: H + 60,
        background:"linear-gradient(160deg,#1f2937,#374151)",
        borderRadius: 42,
        padding: "10px 12px",
        boxShadow:"0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
        position:"relative"
      }}>
        {/* Side buttons */}
        <div style={{ position:"absolute", left:-5, top:90, width:4, height:36, background:"#4b5563", borderRadius:"2px 0 0 2px" }}/>
        <div style={{ position:"absolute", left:-5, top:136, width:4, height:26, background:"#4b5563", borderRadius:"2px 0 0 2px" }}/>
        <div style={{ position:"absolute", right:-5, top:110, width:4, height:50, background:"#4b5563", borderRadius:"0 2px 2px 0" }}/>
        {/* Screen bezel */}
        <div style={{
          width: W, height: H, background:"#000",
          borderRadius: 34, overflow:"hidden",
          border:"2px solid #111", position:"relative"
        }}>
          {/* Dynamic island */}
          <div style={{ position:"absolute", top:8, left:"50%", transform:"translateX(-50%)",
            width:80, height:22, background:"#000",
            borderRadius:14, zIndex:20 }}/>
          {/* Screen content */}
          <div style={{
            width:"100%", height:"100%",
            background:"linear-gradient(180deg,#0f172a,#1e293b)",
            display:"flex", flexDirection:"column"
          }}>
            {/* Status bar */}
            <div style={{ paddingTop:30, flexShrink:0 }}>
              <StatusBar/>
            </div>
            {/* Screen */}
            <div className={anim} style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
              {screenMap[displayScreen] || screenMap["home"]}
            </div>
            {/* Bottom nav */}
            {displayScreen !== "splash" && (
              <BottomNav screen={displayScreen} navigate={navigate}/>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, marginTop:12 }}>
        <button onClick={() => navigate("home")}
          style={{ fontSize:10, padding:"5px 12px", borderRadius:20, border:"1px solid #d1d5db",
            background:"white", cursor:"pointer", color:"#374151", fontWeight:600 }}>
          🔄 Reiniciar
        </button>
        <button onClick={onToggleFullscreen}
          style={{ fontSize:10, padding:"5px 12px", borderRadius:20, border:"1px solid #2563eb",
            background:"#eff6ff", cursor:"pointer", color:"#2563eb", fontWeight:600 }}>
          {fullscreen ? "⬛ Reducir" : "🔲 Ampliar"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── Improvement Board (re-used) ─── */

const STATUS_CONFIG = {
  pendiente:     { label:"Pendiente",     color:"bg-yellow-100 text-yellow-800 border-yellow-200" },
  en_desarrollo: { label:"En desarrollo", color:"bg-blue-100 text-blue-800 border-blue-200" },
  publicada:     { label:"Publicada ✓",   color:"bg-green-100 text-green-800 border-green-200" },
  descartada:    { label:"Descartada",    color:"bg-gray-100 text-gray-500 border-gray-200" },
};
const PRIORITY_CONFIG = {
  LOW:    { label:"Baja",    color:"text-gray-500" },
  NORMAL: { label:"Normal",  color:"text-blue-600" },
  HIGH:   { label:"Alta",    color:"text-orange-500" },
  CRITICA:{ label:"Crítica", color:"text-red-600 font-bold" },
};
const PLATFORM_CONFIG = {
  android:{ label:"Android", icon:"🤖", color:"bg-green-50 border-green-200 text-green-700" },
  ios:    { label:"iPhone",  icon:"🍎", color:"bg-gray-50 border-gray-200 text-gray-700" },
  both:   { label:"Ambas",   icon:"📱", color:"bg-purple-50 border-purple-200 text-purple-700" },
};
const CATEGORY_OPTIONS = [
  { value:"ux",             label:"🎨 UX / Diseño" },
  { value:"funcionalidad",  label:"⚡ Funcionalidad" },
  { value:"rendimiento",    label:"🚀 Rendimiento" },
  { value:"notificaciones", label:"🔔 Notificaciones" },
  { value:"offline",        label:"📴 Modo offline" },
  { value:"scanner",        label:"📷 Escáner" },
  { value:"otro",           label:"💡 Otro" },
];

function ImprovementCard({ item, onVote, onDelete, onStatusChange, isAdmin }) {
  const [expanded, setExpanded] = useState(false);
  const stCfg  = STATUS_CONFIG[item.status]   || STATUS_CONFIG.pendiente;
  const prCfg  = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.NORMAL;
  const plCfg  = PLATFORM_CONFIG[item.platform] || PLATFORM_CONFIG.both;
  return (
    <div className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow ${item.status==="publicada"?"border-green-200":"border-gray-200"}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${plCfg.color}`}>
                {plCfg.icon} {plCfg.label}
              </span>
              {item.category && (
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                  {CATEGORY_OPTIONS.find(c=>c.value===item.category)?.label||item.category}
                </span>
              )}
              <span className={`text-xs font-medium ${prCfg.color}`}>{prCfg.label}</span>
            </div>
            <h3 className="font-semibold text-gray-800 text-sm leading-snug">{item.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">por {item.author_name||"Anónimo"} · {item.created_at?new Date(item.created_at).toLocaleDateString("es-AR"):"—"}</p>
          </div>
          <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full border font-medium ${stCfg.color}`}>{stCfg.label}</span>
        </div>
        {item.description && (
          <button onClick={()=>setExpanded(!expanded)} className="mt-2 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
            {expanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
            {expanded?"Ver menos":"Ver descripción"}
          </button>
        )}
        {expanded&&item.description&&(
          <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">{item.description}</p>
        )}
        {item.admin_reply&&(
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-700 font-semibold mb-0.5">💬 Respuesta del equipo:</p>
            <p className="text-xs text-blue-600">{item.admin_reply}</p>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <button onClick={()=>onVote(item.id)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 px-2.5 py-1 rounded-full transition-colors">
            <ThumbsUp size={11}/> {item.votes||0}
          </button>
          <div className="flex items-center gap-1.5">
            {isAdmin&&(
              <select value={item.status} onChange={e=>onStatusChange(item.id,e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer">
                {Object.entries(STATUS_CONFIG).map(([k,v])=>(
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            )}
            {isAdmin&&(
              <button onClick={()=>{if(confirm("¿Eliminar?"))onDelete(item.id)}}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewImprovementForm({ onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({ title:"", description:"", platform:"both", priority:"NORMAL", category:"" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="bg-white border border-blue-200 rounded-2xl shadow-lg p-5 mb-6">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={15} className="text-blue-600"/> Nueva mejora</h3>
      <form onSubmit={e=>{e.preventDefault();if(!form.title.trim())return;onSubmit(form);}} className="space-y-3">
        <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Título *" required
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <textarea value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Descripción..." rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key:"platform", opts:[["both","�� Ambas"],["android","🤖 Android"],["ios","🍎 iPhone"]] },
            { key:"priority", opts:[["LOW","🔵 Baja"],["NORMAL","🟢 Normal"],["HIGH","🟠 Alta"],["CRITICA","🔴 Crítica"]] },
          ].map(f => (
            <select key={f.key} value={form[f.key]} onChange={e=>set(f.key,e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {f.opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <select value={form.category} onChange={e=>set("category",e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sin categ.</option>
            {CATEGORY_OPTIONS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 disabled:opacity-60">
            {loading?<Loader2 size={12} className="animate-spin"/>:<Plus size={12}/>} Agregar
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────── MAIN PAGE ─────────────────────── */
export default function MobileAppPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm]       = useState(false);
  const [filterPlatform, setFP]       = useState("all");
  const [filterStatus,   setFS]       = useState("all");
  const [fullscreen, setFullscreen]   = useState(false);

  const { data: me } = useQuery({ queryKey:["me"], queryFn:()=>api.get("/auth/me"), staleTime:60000 });
  const isAdmin = me && ["SUPERADMIN","ADMIN","MEGAADMIN"].includes(me.role);

  const { data: improvements = [], isLoading } = useQuery({
    queryKey:["mobile-improvements", filterPlatform, filterStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filterPlatform!=="all") p.set("platform", filterPlatform);
      if (filterStatus!=="all")   p.set("status",   filterStatus);
      return api.get(`/mobile-app/improvements?${p}`);
    },
  });

  const createMut = useMutation({ mutationFn:(b)=>api.post("/mobile-app/improvements",b),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["mobile-improvements"]}); setShowForm(false); } });
  const voteMut   = useMutation({ mutationFn:(id)=>api.post(`/mobile-app/improvements/${id}/vote`,{}),
    onSuccess:()=>qc.invalidateQueries({queryKey:["mobile-improvements"]}) });
  const updateMut = useMutation({ mutationFn:({id,status})=>api.put(`/mobile-app/improvements/${id}`,{status}),
    onSuccess:()=>qc.invalidateQueries({queryKey:["mobile-improvements"]}) });
  const deleteMut = useMutation({ mutationFn:(id)=>api.delete(`/mobile-app/improvements/${id}`),
    onSuccess:()=>qc.invalidateQueries({queryKey:["mobile-improvements"]}) });

  const stats = {
    total:      improvements.length,
    pendientes: improvements.filter(i=>i.status==="pendiente").length,
    desarrollo: improvements.filter(i=>i.status==="en_desarrollo").length,
    publicadas: improvements.filter(i=>i.status==="publicada").length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{PHONE_CSS}</style>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-300 mb-1">
              <Zap size={12} className="text-yellow-400"/> App Nativa · Capacitor
            </div>
            <h1 className="text-2xl font-black">📱 Aplicación Celular</h1>
            <p className="text-blue-200 text-xs mt-1">Simulación interactiva con datos reales del ERP</p>
          </div>
          <a href="#apk"
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-lg">
            <Download size={14}/> Descargar APK Android
          </a>
        </div>
      </div>

      {/* ── Main: Phone + Info ─────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className={`flex gap-8 ${fullscreen ? "flex-col items-center" : "flex-col lg:flex-row items-start"}`}>

          {/* LEFT: Phone Simulator */}
          <div className={`${fullscreen ? "w-full flex justify-center" : "lg:sticky lg:top-4"} flex-shrink-0`}>
            <div className="flex flex-col items-center">
              <div className="text-center mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Preview interactivo — datos reales del ERP
                </span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="ani-pulse w-2 h-2 rounded-full bg-green-500 inline-block"/>
                <span className="text-xs text-green-600 font-semibold">EN VIVO</span>
              </div>
              <PhoneSimulator fullscreen={fullscreen} onToggleFullscreen={()=>setFullscreen(!fullscreen)}/>
            </div>
          </div>

          {/* RIGHT: Info + Improvements */}
          <div className="flex-1 min-w-0">
            {/* Arquitectura — misma app para ambas plataformas */}
            <div className="bg-gradient-to-r from-blue-900 to-slate-800 rounded-2xl p-5 text-white mb-5 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚡</span>
                <h3 className="font-bold text-sm">¿Es la misma app para Android e iPhone?</h3>
              </div>
              <p className="text-blue-100 text-xs leading-relaxed mb-4">
                <strong className="text-white">Sí, exactamente la misma.</strong> La app usa <strong className="text-green-400">Capacitor</strong> para empaquetar el frontend React como app nativa. El mismo código genera el APK para Android <em>y</em> el IPA para iPhone — solo cambia el empaquetado.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-3 border border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🤖</span>
                    <span className="text-sm font-bold">Android</span>
                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full ml-auto">✓ Listo</span>
                  </div>
                  <p className="text-xs text-blue-200 leading-relaxed">APK disponible para instalar ahora mismo.</p>
                  <button onClick={()=>{ const l=document.createElement("a"); l.href="/api/v1/mobile-app/download-apk"; l.download="ERP-MundoOutdoor.apk"; l.click(); }}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-400 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors">
                    <Download size={12}/> Descargar APK
                  </button>
                </div>
                <div className="bg-white/10 rounded-xl p-3 border border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🍎</span>
                    <span className="text-sm font-bold">iPhone / iOS</span>
                    <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full ml-auto font-bold">⚙ Build</span>
                  </div>
                  <p className="text-xs text-blue-200 leading-relaxed">El código está listo. Para compilar el IPA se necesita Mac + Xcode.</p>
                  <div className="mt-2 text-xs text-yellow-300 font-mono bg-black/30 rounded p-1.5">
                    npx cap add ios<br/>npx cap build ios
                  </div>
                </div>
              </div>
            </div>

            {/* APK Download */}
            <div id="apk" className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-5 text-white mb-5 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🤖</span>
                <div>
                  <h3 className="font-bold">APK Android — Versión actual</h3>
                  <p className="text-green-100 text-xs">Instalá directamente en tu Android. Requiere "fuentes desconocidas".</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={()=>{ const l=document.createElement("a"); l.href="/api/v1/mobile-app/download-apk"; l.download="ERP-MundoOutdoor.apk"; l.click(); }}
                  className="flex items-center gap-2 bg-white text-green-700 font-bold px-4 py-2 rounded-xl hover:bg-green-50 text-sm">
                  <Download size={14}/> Descargar .apk
                </button>
              </div>
            </div>

            {/* Funcionalidades */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">🚀 Funcionalidades — Android ✅ · iPhone ✅ (mismo código)</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["✅","Dashboard con stats en vivo"],
                  ["✅","Búsqueda de stock en tiempo real"],
                  ["✅","Pedidos y estados de compra"],
                  ["✅","Alertas de stock bajo"],
                  ["✅","Chat con Nexus IA (streaming)"],
                  ["✅","Ingresos recientes"],
                  ["🔜","Escáner de código de barras"],
                  ["🔜","Notificaciones push nativas"],
                  ["🔜","Modo offline completo"],
                  ["🔜","App Store / Play Store"],
                ].map(([s,t],i)=>(
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <span>{s}</span><span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[
                { l:"Sugerencias",  v:stats.total,      c:"text-blue-600",   b:"bg-blue-50" },
                { l:"Pendientes",   v:stats.pendientes, c:"text-yellow-600", b:"bg-yellow-50" },
                { l:"Desarrollando",v:stats.desarrollo, c:"text-blue-500",   b:"bg-blue-50" },
                { l:"Publicadas",   v:stats.publicadas, c:"text-green-600",  b:"bg-green-50" },
              ].map((s,i)=>(
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm text-center">
                  <div className={`text-xl font-black ${s.c}`}>{s.v}</div>
                  <div className="text-xs text-gray-400 mt-0.5 leading-tight">{s.l}</div>
                </div>
              ))}
            </div>

            {/* Improvements Board */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-black text-gray-900">💡 Mejoras sugeridas</h2>
                <p className="text-xs text-gray-500">Votá las que más querés ver implementadas</p>
              </div>
              <button onClick={()=>setShowForm(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow">
                <Plus size={13}/> Nueva mejora
              </button>
            </div>

            {showForm && (
              <NewImprovementForm
                onSubmit={(b)=>createMut.mutate(b)}
                onCancel={()=>setShowForm(false)}
                loading={createMut.isPending}
              />
            )}

            {/* Filtros */}
            <div className="flex flex-wrap gap-1.5 mb-4 bg-white border border-gray-200 rounded-xl p-2.5">
              {[["all","📱 Todas"],["android","🤖 Android"],["ios","🍎 iPhone"],["both","Ambas"]].map(([v,l])=>(
                <button key={v} onClick={()=>setFP(v)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors
                    ${filterPlatform===v?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}>{l}</button>
              ))}
              <div className="w-px bg-gray-200 mx-0.5"/>
              {[["all","Todos"],["pendiente","Pendiente"],["en_desarrollo","Desarrollo"],["publicada","Publicadas"]].map(([v,l])=>(
                <button key={v} onClick={()=>setFS(v)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors
                    ${filterStatus===v?"bg-slate-800 text-white border-slate-800":"bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{l}</button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2"/> Cargando...
              </div>
            ) : improvements.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">💡</div>
                <p className="text-gray-500 text-sm font-medium">Sin mejoras todavía</p>
                <button onClick={()=>setShowForm(true)}
                  className="mt-3 inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-xl text-xs hover:bg-blue-700">
                  <Plus size={12}/> Ser el primero
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {improvements.map(imp => (
                  <ImprovementCard key={imp.id} item={imp} isAdmin={isAdmin}
                    onVote={(id)=>voteMut.mutate(id)}
                    onDelete={(id)=>deleteMut.mutate(id)}
                    onStatusChange={(id,status)=>updateMut.mutate({id,status})}/>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

