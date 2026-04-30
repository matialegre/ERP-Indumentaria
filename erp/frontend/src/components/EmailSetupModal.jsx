import { useState } from "react";
import { Mail, LogOut } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

export default function EmailSetupModal() {
  const { user, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async (body) => api.put("/auth/me/email", body),
    onSuccess: () => {
      window.location.reload();
    },
    onError: (err) => {
      setError(err?.response?.data?.detail || err?.message || "No se pudo guardar el email");
    },
  });

  // Solo mostrar cuando hay usuario, NO tiene email cargado, y el ProfileSetupModal NO está visible.
  // ProfileSetupModal se muestra cuando profile_complete=false y el rol no es MEGA/SUPER.
  // Si está visible, dejamos que ese modal maneje el alta de email.
  if (!user) return null;
  const hasEmail = !!(user.email && String(user.email).trim());
  if (hasEmail) return null;

  const profileSetupVisible =
    !["MEGAADMIN", "SUPERADMIN"].includes(user.role) && !user.profile_complete;
  if (profileSetupVisible) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError("Ingresá un email válido (ej: nombre@dominio.com)");
      return;
    }
    mutation.mutate({ email: value });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Mail size={28} />
            <h2 className="text-xl font-bold">Registrá tu email</h2>
          </div>
          <p className="text-emerald-100 text-sm">
            Para continuar, necesitamos un email asociado a tu cuenta. Se usará para recuperar la contraseña y recibir notificaciones del sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@dominio.com"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              autoComplete="email"
              autoFocus
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Usuario actual: <span className="font-medium text-gray-600">{user.username}</span>
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <LogOut size={16} /> Salir
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold shadow hover:opacity-95 disabled:opacity-60"
            >
              {mutation.isPending ? "Guardando..." : "Guardar y continuar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
