import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { isAuthenticated, setAuthSession } from "../utils/authStorage";
import { mitrakamiApi } from "../services/mitrakamiApi";
import AppIcon from "../components/AppIcon";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ memberId: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const alreadyLoggedIn = useMemo(() => isAuthenticated(), []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "memberId") {
      const normalizedValue = value
        .toUpperCase()
        .replace(/^PRIME/i, "")
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9]/g, "");

      setForm((prev) => ({ ...prev, memberId: normalizedValue }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.memberId.trim() || !form.password.trim()) {
      setError("Member ID dan password wajib diisi.");
      return;
    }

    const memberIdSuffix = form.memberId.trim().toUpperCase();
    const distributorId = `PRIME${memberIdSuffix}`;

    try {
      setIsSubmitting(true);

      const loginResponse = await mitrakamiApi.loginMember({
        distributorId,
        password: form.password,
      });

      const user = loginResponse?.user ?? {};
      const packageValue = user?.package;
      const packageName =
        typeof packageValue === "string"
          ? packageValue
          : (packageValue?.name ?? "");

      const session = {
        memberId: user?.member_id ?? distributorId,
        memberName: user?.name ?? user?.username ?? distributorId,
        username: user?.username ?? null,
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        city: user?.city ?? null,
        province: user?.state ?? null,
        address: user?.address ?? null,
        packageName,
        avatar: user?.avatar ?? user?.profile_photo ?? null,
        walletBalance: Number(user?.wallet_balance ?? 0),
        status: user?.status ?? null,
        token: loginResponse?.token ?? null,
        loggedInAt: Date.now(),
      };

      setAuthSession(session);
      navigate("/app/home", { replace: true });
    } catch (requestError) {
      const responseMessage = requestError?.response?.data?.message;
      const validationErrors = requestError?.response?.data?.errors;
      const firstValidationError = validationErrors
        ? Object.values(validationErrors)?.[0]?.[0]
        : null;

      setError(
        responseMessage ||
          firstValidationError ||
          "Login gagal. Periksa Member ID dan password Anda.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (alreadyLoggedIn) {
    return <Navigate to="/app/home" replace />;
  }

  return (
    <div className="min-h-screen bg-background-app text-text-primary flex items-center justify-center">
      <div className="w-full max-w-md min-h-screen relative flex flex-col justify-between overflow-hidden shadow-2xl bg-background-app">
        <div className="absolute top-0 left-0 w-full h-96 bg-linear-to-b from-primary/10 to-transparent pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="px-8 pt-12 pb-6 flex-1 flex flex-col justify-center">
          <div className="mb-10 text-center relative z-10">
            <div className="mx-auto mb-5 w-20 h-20 rounded-3xl backdrop-blur-sm shadow-lg shadow-primary/10 flex items-center justify-center">
              <img
                src="/apple-touch-icon.png"
                alt="Logo Mitrakami"
                className="w-20 h-20 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold mb-3">Selamat Datang Kembali</h1>
            <p className="text-text-secondary text-sm">
              Masuk untuk mulai penghematanmu bersama Mitrakami
            </p>
          </div>

          <form className="space-y-5 relative z-10" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="memberId" className="text-sm font-semibold ml-1">
                Member ID
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AppIcon
                    name="person_outline"
                    className="size-5 text-gray-400 group-focus-within:text-primary transition-colors"
                  />
                </div>
                <span className="absolute inset-y-0 left-12 flex items-center text-text-secondary pointer-events-none">
                  PRIME
                </span>
                <input
                  id="memberId"
                  name="memberId"
                  type="text"
                  value={form.memberId}
                  onChange={handleChange}
                  placeholder="Masukkan ID Anda"
                  className="block w-full pl-26 pr-4 py-4 bg-white border border-gray-200 rounded-3xl focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder-gray-400 transition-all shadow-sm uppercase"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold ml-1">
                Kata Sandi
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AppIcon
                    name="lock"
                    className="size-5 text-gray-400 group-focus-within:text-primary transition-colors"
                  />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-12 py-4 bg-white border border-gray-200 rounded-3xl focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder-gray-400 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-text-secondary transition-colors"
                >
                  <AppIcon
                    name={showPassword ? "visibility_off" : "visibility"}
                    className="size-5"
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
              >
                Lupa Kata Sandi?
              </button>
            </div>

            {error && (
              <p className="text-sm font-medium text-red-500">{error}</p>
            )}

            <button
              className="w-full bg-primary hover:opacity-90 text-white font-bold py-4 rounded-3xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
              type="submit"
              disabled={isSubmitting}
            >
              <span>{isSubmitting ? "Memproses..." : "Masuk"}</span>
              <AppIcon name="arrow_forward" className="size-5" />
            </button>
          </form>

          <div className="p-6 text-center relative z-10">
            <p className="text-text-secondary text-sm">
              Copyright &copy; {new Date().getFullYear()}{" "} by
              <Link
                to="https://mitrakami.app"
                className="text-primary font-bold hover:underline ml-1"
              >
                Mitrakami
              </Link>
              . All rights reserved.
            </p>
            <p className="text-text-secondary text-xs mt-1">
              Versi 1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
