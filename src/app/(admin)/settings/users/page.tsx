"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Pencil,
  Shield,
  UserCheck,
  UserX,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  phone: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: {
    label: "Administrator",
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  operator: {
    label: "Operator",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  client: {
    label: "Klient",
    color: "bg-zinc-50 text-zinc-600 border-zinc-200",
  },
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function toggleActive(user: UserRecord) {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.is_active }),
    });
    fetchUsers();
  }

  async function changeRole(userId: string, role: string) {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    fetchUsers();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Użytkownicy</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {users.length} użytkownikow w systemie
          </p>
        </div>
        <button
          onClick={() => {
            setEditUser(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800"
        >
          <Plus size={16} />
          Dodaj użytkownika
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                Użytkownik
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                Rola
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                Status
              </th>
              <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const roleConfig = ROLE_LABELS[u.role] ?? {
                label: u.role,
                color: "bg-zinc-50 text-zinc-600 border-zinc-200",
              };
              return (
                <tr
                  key={u.id}
                  className={`border-b border-zinc-100 last:border-0 transition-colors hover:bg-zinc-50/50 ${
                    !u.is_active ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-zinc-900">
                          {u.full_name}
                        </p>
                        {u.phone && (
                          <p className="text-[11px] text-zinc-400">
                            {u.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-zinc-600">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className={`rounded-md border px-2 py-0.5 text-[12px] font-medium ${roleConfig.color}`}
                    >
                      <option value="admin">Administrator</option>
                      <option value="operator">Operator</option>
                      <option value="client">Klient</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="flex items-center gap-1 text-[12px] text-emerald-600">
                        <UserCheck size={14} />
                        Aktywny
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[12px] text-zinc-400">
                        <UserX size={14} />
                        Nieaktywny
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditUser(u);
                          setShowForm(true);
                        }}
                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                        title="Edytuj"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        className={`rounded p-1.5 ${
                          u.is_active
                            ? "text-zinc-400 hover:bg-red-50 hover:text-red-500"
                            : "text-zinc-400 hover:bg-emerald-50 hover:text-emerald-500"
                        }`}
                        title={u.is_active ? "Dezaktywuj" : "Aktywuj"}
                      >
                        {u.is_active ? (
                          <UserX size={14} />
                        ) : (
                          <UserCheck size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal dodawania/edycji */}
      {showForm && (
        <UserForm
          user={editUser}
          onClose={() => {
            setShowForm(false);
            setEditUser(null);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function UserForm({
  user,
  onClose,
}: {
  user: UserRecord | null;
  onClose: () => void;
}) {
  const isEdit = !!user;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "operator");
  const [phone, setPhone] = useState(user?.phone ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isEdit) {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, role, phone }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Blad zapisu");
        setLoading(false);
        return;
      }
    } else {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role, phone }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Blad tworzenia");
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16 pb-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-[15px] font-semibold text-zinc-900">
            {isEdit ? "Edytuj użytkownika" : "Nowy użytkownik"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Imie i nazwisko *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Jan Kowalski"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          {!isEdit && (
            <>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="jan@grupa-plus.pl"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                  Haslo * (min. 6 znaków)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Rola *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="admin">Administrator</option>
                <option value="operator">Operator</option>
                <option value="client">Klient</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Telefon
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="123 456 789"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-[13px]"
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-zinc-900 text-[13px] text-white hover:bg-zinc-800"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {isEdit ? "Zapisywanie..." : "Tworzenie..."}
                </span>
              ) : isEdit ? (
                "Zapisz zmiany"
              ) : (
                "Dodaj użytkownika"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
