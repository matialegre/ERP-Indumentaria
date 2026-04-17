import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Bot, Send, Trash2, Copy, Check, ChevronDown, ChevronUp,
  Cpu, Zap, Package, ShoppingCart, FileText, BarChart3, MapPin,
  Sparkles,
} from "lucide-react";

/* ─── Herramientas: nombre → ícono y label legible ─── */
const TOOL_META = {
  get_stock_resumen:     { icon: Package,      label: "Consultando stock..."         },
  buscar_productos:      { icon: Package,      label: "Buscando productos..."        },
  get_pedidos_pendientes:{ icon: ShoppingCart, label: "Revisando pedidos..."         },
  get_ventas_recientes:  { icon: BarChart3,    label: "Consultando ventas..."        },
  get_facturas_pendientes:{ icon: FileText,    label: "Revisando facturas..."        },
  get_alertas_stock:     { icon: Zap,          label: "Buscando alertas..."          },
  get_locales_resumen:   { icon: MapPin,       label: "Consultando locales..."       },
};

const SUGGESTIONS = [
  "¿Cuántos productos tenemos en stock?",
  "¿Qué pedidos están pendientes?",
  "Mostrame alertas de stock bajo",
  "¿Cuánto vendimos esta semana?",
  "¿Qué facturas están pendientes?",
  "Buscame productos con 'campera'",
];

/* ─── Renderizado mínimo de markdown ─── */
function MarkdownText({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-1 leading-relaxed text-[13px]">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <p key={i} className="font-bold text-sm mt-2">{line.slice(4)}</p>;
        if (line.startsWith("## "))  return <p key={i} className="font-bold text-sm mt-2">{line.slice(3)}</p>;
        if (line.startsWith("# "))   return <p key={i} className="font-bold text-base mt-2">{line.slice(2)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = renderInline(line.slice(2));
          return <div key={i} className="flex gap-1.5 ml-2"><span className="text-blue-400 mt-0.5">•</span><span>{content}</span></div>;
        }
        if (/^\d+\. /.test(line)) {
          const match = line.match(/^(\d+)\. (.+)/);
          if (match) return <div key={i} className="flex gap-1.5 ml-2"><span className="text-blue-400 min-w-[16px]">{match[1]}.</span><span>{renderInline(match[2])}</span></div>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-slate-700 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

/* ─── Tarjeta de tool call ─── */
function ToolCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TOOL_META[event.name] || { icon: Cpu, label: event.name };
  const Icon = meta.icon;
  const isDone = !!event.result;

  return (
    <div className="my-1.5 mx-2">
      <button
        onClick={() => isDone && setExpanded(!expanded)}
        className={`flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-full border transition-all ${
          isDone
            ? "bg-emerald-900/30 border-emerald-700/40 text-emerald-300 cursor-pointer hover:bg-emerald-900/50"
            : "bg-blue-900/30 border-blue-700/40 text-blue-300 cursor-default"
        }`}
      >
        {!isDone && <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />}
        {isDone && <Icon size={12} className="shrink-0" />}
        <span>{isDone ? `✓ ${meta.label.replace("...", "")}` : meta.label}</span>
        {isDone && (expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </button>
      {expanded && event.result && (
        <div className="mt-1 ml-3 bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5 text-[11px] text-slate-300 font-mono overflow-auto max-h-40">
          <pre className="whitespace-pre-wrap">{JSON.stringify(event.result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/* ─── Mensaje individual ─── */
function Message({ msg, isStreaming }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  function copyText() {
    const text = msg.parts?.filter(p => p.type === "text").map(p => p.text).join("") || msg.content || "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-3 px-4">
        <div className="max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px]">
          {msg.content}
        </div>
      </div>
    );
  }

  // Renderizar partes del mensaje del asistente (tokens + tool cards)
  const parts = msg.parts || [{ type: "text", text: msg.content || "" }];
  const textParts = parts.filter(p => p.type === "text").map(p => p.text).join("");

  return (
    <div className="mb-3 group">
      <div className="flex items-start gap-2 px-4">
        <div className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
          <Bot size={13} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {parts.map((part, i) => {
            if (part.type === "tool_start") return <ToolCard key={i} event={{ name: part.name, args: part.args }} />;
            if (part.type === "tool_result") return <ToolCard key={i} event={{ name: part.name, result: part.result, args: {} }} />;
            if (part.type === "text" && part.text) {
              // Solo mostrar el último bloque de texto completo si hay múltiples
              const isLast = parts.slice(i + 1).every(p => p.type !== "text" || !p.text);
              if (!isLast) return null;
              return (
                <div key={i} className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3 text-slate-100 mt-1">
                  <MarkdownText text={part.text} />
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-blue-400 animate-pulse ml-0.5 rounded-sm" />
                  )}
                </div>
              );
            }
            return null;
          })}
          {textParts === "" && !isStreaming && (
            <div className="text-slate-500 text-[12px] italic mt-1 ml-1">Sin respuesta</div>
          )}
        </div>
        {textParts && (
          <button
            onClick={copyText}
            className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition text-slate-500 hover:text-slate-300"
            title="Copiar"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Página principal ─── */
export default function AsistentePage() {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    inputRef.current?.focus();
  }, []);

  async function sendMessage(text) {
    const userText = (text || input).trim();
    if (!userText || streaming) return;
    setInput("");

    // Agregar mensaje del usuario
    const userMsg = { id: Date.now(), role: "user", content: userText };
    setMessages(prev => [...prev, userMsg]);

    // Construir historial para el backend
    const history = messages.map(m => ({
      role: m.role,
      content: m.parts
        ? m.parts.filter(p => p.type === "text").map(p => p.text).join("")
        : (m.content || ""),
    })).filter(m => m.content);
    history.push({ role: "user", content: userText });

    // Placeholder del asistente con parts
    const assistantId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", parts: [] }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/v1/asistente/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event;
          try { event = JSON.parse(raw); } catch { continue; }

          setMessages(prev => prev.map(m => {
            if (m.id !== assistantId) return m;
            const parts = [...(m.parts || [])];

            if (event.type === "token") {
              const last = parts[parts.length - 1];
              if (last?.type === "text") {
                parts[parts.length - 1] = { ...last, text: last.text + event.delta };
              } else {
                parts.push({ type: "text", text: event.delta });
              }
            } else if (event.type === "tool_start") {
              parts.push({ type: "tool_start", name: event.name, args: event.args });
            } else if (event.type === "tool_result") {
              // Encontrar el tool_start correspondiente y convertirlo en tool_result
              const idx = parts.findLastIndex(p => p.type === "tool_start" && p.name === event.name);
              if (idx >= 0) {
                parts[idx] = { type: "tool_result", name: event.name, result: event.result, args: parts[idx].args };
              }
            } else if (event.type === "error") {
              parts.push({ type: "text", text: `\n\n❌ Error: ${event.message}` });
            }

            return { ...m, parts };
          }));
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, parts: [{ type: "text", text: "❌ Error de conexión. Intentá de nuevo." }] }
            : m
        ));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-slate-900">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white">Nexus IA</h1>
            <p className="text-[11px] text-slate-400">Asistente inteligente del ERP · GPT-4o mini</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {streaming && (
            <span className="flex items-center gap-1.5 text-[11px] text-blue-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
              Pensando...
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-red-400 transition px-2 py-1 rounded"
            >
              <Trash2 size={13} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-2xl">
              <Sparkles size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">¡Hola! Soy Nexus</h2>
              <p className="text-sm text-slate-400 max-w-xs">
                Puedo consultar datos reales de tu ERP: stock, pedidos, ventas, facturas y más.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-[12px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2.5 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            {messages.map((msg) => (
              <Message
                key={msg.id}
                msg={msg}
                isStreaming={streaming && msg.role === "assistant" && msg.id === messages[messages.length - 1]?.id}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntale algo al ERP... (Enter para enviar)"
              rows={1}
              disabled={streaming}
              className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-[13px] resize-none outline-none focus:border-blue-500 transition disabled:opacity-50 pr-12"
              style={{ minHeight: "44px", maxHeight: "120px" }}
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            className="shrink-0 w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white flex items-center justify-center transition shadow-lg"
          >
            {streaming
              ? <span className="w-4 h-4 rounded border-2 border-slate-400 border-t-transparent animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-600 mt-2">
          Nexus puede cometer errores. Verificá datos importantes directamente en el ERP.
        </p>
      </div>
    </div>
  );
}
