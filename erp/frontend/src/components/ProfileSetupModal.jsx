/**
 * ProfileSetupModal — Se muestra la primera vez que un usuario se logea.
 * Permite elegir nombre completo, username y opcionalmente nueva contraseña.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { UserCircle, Check, AlertCircle, Loader2 } from "lucide-react";

export default function ProfileSetupModal() {
  const { user, logout } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (body) => api.put("/auth/me/profile", body),
    onSuccess: (data) => {
      // Save new token (username may have changed)
      if (data.access_token) {
        sessionStorage.setItem("token", data.access_token);
      }
      // Reload to apply new user data
      window.location.reload();
    },
    onError: (err) => {
      setError(err.message || "Error al guardar");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (fullName.trim().length < 2) {
      setError("Ingresá tu nombre completo");
      return;
    }
    if (username.trim().length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres");
      return;
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(username.trim())) {
      setError("El usuario solo puede tener letras, números, punto y guion bajo");
      return;
    }
    if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email.trim())) {
      setError("Ingresá un email válido (ej: nombre@dominio.com)");
      return;
    }
    if (newPassword && newPassword.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres");
      return;
    }
    if (newPassword && newPassword !== confirmPass) {
      setError("Las contraseñas no coinciden");
      return;
    }

    const body = {
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
    };
    if (newPassword) body.new_password = newPassword;
    mutation.mutate(body);
  };

  // Don't show for MEGAADMIN/SUPERADMIN (they don't need setup)
  if (!user || ["MEGAADMIN", "SUPERADMIN"].includes(user.role)) return null;
  if (user.profile_complete) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-blue-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <UserCircle size={28} />
            <h2 className="text-xl font-bold">¡Bienvenido al ERP!</h2>
          </div>
          <p className="text-violet-100 text-sm">
            Configurá tu cuenta antes de empezar. Elegí cómo querés identificarte en el sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre completo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nombre y Apellido
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: María López"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              autoFocus
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nombre de usuario para entrar
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                placeholder="mlopez"
                className="w-full border border-gray-300 rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Solo letras, números, punto y guion bajo. Será único.</p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@dominio.com"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              autoComplete="email"
            />
            <p className="text-xs text-gray-400 mt-1">Usado para notificaciones y recuperación de contraseña.</p>
          </div>

          {/* Nueva contraseña */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nueva contraseña <span className="text-gray-400 font-normal">(opcional — dejar vacío para mantener la actual)</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
            />
          </div>

          {newPassword && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-violet-700 transition disabled:opacity-60"
            >
              {mutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              ) : (
                <><Check size={16} /> Guardar y entrar</>
              )}
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition"
            >
              Salir
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center pt-1">
            Podés cambiar estos datos después desde tu perfil.
          </p>
        </form>
      </div>
    </div>
  );
}
