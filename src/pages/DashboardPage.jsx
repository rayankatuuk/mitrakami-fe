import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthSession, updateAuthSession } from "../utils/authStorage";
import { mitrakamiApi } from "../services/mitrakamiApi";
import { buildApiUrl } from "../services/apiClient";
import MobileBottomNav from "../components/MobileBottomNav";
import { resolvePackageAvatarPath } from "../utils/memberPackageAvatar";
import AppIcon from "../components/AppIcon";

const PAYMENT_ITEMS = [
  {
    icon: "flight",
    label: "Tiket Pesawat",
    color: "text-blue-500",
    bg: "bg-blue-50 border-blue-100",
    route: "/app/flights/search",
  },
  {
    icon: "train",
    label: "Tiket Kereta",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-100",
  },
  {
    icon: "hotel",
    label: "Hotel",
    color: "text-[#2f834f]",
    bg: "bg-[#eef7f1] border-[#cfe7d8]",
    route: "/app/hotels/reservation",
  },
  {
    icon: "smartphone",
    label: "Pulsa",
    color: "text-violet-500",
    bg: "bg-violet-50 border-violet-100",
    route: "/app/pulsa",
  },
  {
    icon: "add_call",
    label: "Paket Telepon",
    color: "text-sky-500",
    bg: "bg-sky-50 border-sky-100",
    route: "/app/paket-telepon",
  },
  {
    icon: "electric_bolt",
    label: "PLN",
    color: "text-yellow-500",
    bg: "bg-yellow-50 border-yellow-100",
    route: "/app/bills?service=pln-token",
  },
  {
    icon: "wifi",
    label: "Internet",
    color: "text-teal-500",
    bg: "bg-teal-50 border-teal-100",
    route: "/app/bills?service=internet-pascabayar",
  },
  {
    icon: "account_balance_wallet",
    label: "Top Up E-Wallet",
    color: "text-indigo-500",
    bg: "bg-indigo-50 border-indigo-100",
    route: "/app/topup-ewallet",
  },
  {
    icon: "local_offer",
    label: "Voucher Games",
    color: "text-emerald-500",
    bg: "bg-emerald-50 border-emerald-100",
    route: "/app/voucher-games",
  },
  {
    icon: "storefront",
    label: "Mitra Store",
    color: "text-orange-500",
    bg: "bg-orange-50 border-orange-100",
  },
  {
    icon: "receipt_long",
    label: "Tagihan",
    color: "text-pink-500",
    bg: "bg-pink-50 border-pink-100",
    route: "/app/bills",
  },
];

const STORE_ITEMS = [
  {
    title: "Herbal Tea",
    category: "Health & Wellness",
    image:
      "https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Baso Aci",
    category: "Hot & Spicy",
    badge: "NEW",
    image:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Spicy Chips",
    category: "Snacks",
    badge: "PROMO",
    badgeClass: "bg-red-500 text-white",
    image:
      "https://images.unsplash.com/photo-1613919113640-25732ec5e61f?auto=format&fit=crop&w=600&q=80",
  },
];

const formatCurrency = (value) => `Rp ${Number(value).toLocaleString("id-ID")}`;

const normalizePackageSuffix = (packageName) => {
  if (!packageName) return "Member";
  const suffix = packageName.replace(/^prime\s+/i, "").trim();
  return suffix || "Member";
};

const resolveAvatarUrl = (avatar, packageName) => {
  if (!avatar) return resolvePackageAvatarPath(packageName);
  if (/^https?:\/\//i.test(avatar)) return avatar;

  return buildApiUrl(avatar);
};

const isLocalDevHost = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
};

export default function DashboardPage({ currentTab = "home" }) {
  const navigate = useNavigate();
  const [authSession, setAuthSessionState] = useState(() => getAuthSession());
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const hasTriedRealtimeSync = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const currentSession = getAuthSession() ?? {};
    const shouldSkipRealtimeSync =
      isLocalDevHost() ||
      currentSession?.serverAuthUnavailable ||
      hasTriedRealtimeSync.current;

    if (shouldSkipRealtimeSync) {
      return () => {
        isMounted = false;
      };
    }

    hasTriedRealtimeSync.current = true;

    const syncRealtimeProfile = async () => {
      try {
        const profile = await mitrakamiApi.getCurrentMember();
        if (!isMounted || !profile) return;

        const latestSession = getAuthSession() ?? {};

        const updatedSession = {
          ...latestSession,
          memberId: profile.member_id ?? latestSession?.memberId,
          memberName:
            profile.name ?? profile.username ?? latestSession?.memberName,
          packageName: profile.package?.name ?? latestSession?.packageName,
          avatar: profile.avatar ?? latestSession?.avatar,
          walletBalance: profile.wallet_balance != null
            ? Number(profile.wallet_balance)
            : latestSession?.walletBalance,
          totalPv: profile.total_pv != null
            ? Number(profile.total_pv)
            : latestSession?.totalPv,
        };

        setAuthSessionState(updatedSession);
        updateAuthSession(updatedSession);
      } catch (error) {
        const status = error?.response?.status ?? error?.status;

        if (status === 401) {
          const latestSession = getAuthSession() ?? {};
          const unavailableSession = {
            ...latestSession,
            serverAuthUnavailable: true,
          };

          if (isMounted) {
            setAuthSessionState(unavailableSession);
          }

          updateAuthSession(unavailableSession);
        }
      }
    };

    syncRealtimeProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayName = useMemo(
    () => authSession?.memberName || authSession?.memberId || "Member Prime",
    [authSession],
  );
  const displayPackage = useMemo(
    () => `Prime ${normalizePackageSuffix(authSession?.packageName)}`,
    [authSession],
  );
  const displayAvatar = useMemo(
    () => resolveAvatarUrl(authSession?.avatar, authSession?.packageName),
    [authSession],
  );
  const displayBalance = useMemo(
    () => Number(authSession?.walletBalance ?? 0),
    [authSession],
  );

  const handlePaymentItemClick = (item) => {
    if (!item?.route) {
      return;
    }

    navigate(item.route);
  };

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-28">
        <header className="px-6 pt-12 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={displayAvatar}
                alt="User avatar"
                className="size-14 rounded-full object-cover"
              />
              <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Halo,</p>
              <h1 className="text-xl font-bold leading-tight">{displayName}</h1>
            </div>
          </div>
        </header>

        <section className="px-6 mb-8">
          <div className="rounded-3xl bg-white p-5 shadow-soft border border-black/5">
            <p className="text-sm text-text-secondary mb-2 font-bold">
              {displayPackage}
            </p>

            <div className="flex flex-row justify-between">
              <div>
                <div className="flex items-center gap-2 text-text-secondary mb-1">
              <span className="text-sm">Total Saldo</span>
              <button
                type="button"
                onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                className="cursor-pointer hover:text-text-primary transition-colors"
                aria-label={isBalanceVisible ? "Hide balance" : "Show balance"}
              >
                <AppIcon
                  name={isBalanceVisible ? "visibility" : "visibility_off"}
                  className="size-4"
                />
              </button>
            </div>

            <h2 className="text-xl font-bold tracking-tight mb-5">
              {isBalanceVisible ? formatCurrency(displayBalance) : "Rp ******"}
            </h2>

              </div>
              

            <div className="flex pr-2">
              <button
                className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                type="button"
                onClick={() => navigate('/app/topup')}
              >
                <span className="size-10 rounded-full bg-primary-soft text-primary grid place-items-center">
                  <AppIcon name="wallet" className="size-5" />
                </span>
                <span className="text-xs font-medium text-text-secondary">
                  Top Up
                </span>
              </button>
            </div>

            </div>

            
          </div>
        </section>

        <section className="px-6 mb-8">
          <h3 className="text-xl font-bold mb-5">Pembayaran & Tagihan</h3>
          <div className="grid grid-cols-4 gap-y-6 gap-x-2">
            {PAYMENT_ITEMS.map((item) => {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handlePaymentItemClick(item)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <span
                    className={`size-16 rounded-full border ${item.bg} grid place-items-center transition-colors group-hover:bg-white`}
                  >
                    <AppIcon
                      name={item.icon}
                      className={`size-7.5 ${item.color}`}
                    />
                  </span>
                  <span className="text-sm text-text-secondary font-medium">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="pl-6 mb-8">
          <div className="pr-6 flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Mitra UMKM</h3>
            <button
              type="button"
              className="text-primary font-semibold inline-flex items-center gap-1 text-sm"
            >
              Lihat Semua
              <AppIcon name="chevron_right" className="size-4" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pr-6 pb-2">
            {STORE_ITEMS.map((item) => (
              <article
                key={item.title}
                className="min-w-42.5 h-62.5 rounded-3xl overflow-hidden relative"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/75 to-black/5" />

                <button
                  type="button"
                  className="absolute top-3 right-3 size-10 rounded-full bg-white/95 grid place-items-center"
                  aria-label="Favorite"
                >
                  <AppIcon name="favorite_border" className="size-5 text-gray-500" />
                </button>

                {item.badge && (
                  <span
                    className={`absolute top-3 left-0 px-2 py-1 text-[10px] font-bold rounded-r-full ${item.badgeClass ?? "bg-yellow-400 text-black"}`}
                  >
                    {item.badge}
                  </span>
                )}

                <div className="absolute left-3 right-3 bottom-4 text-white">
                  <p className="text-sm opacity-90">{item.category}</p>
                  <p className="text-xl font-bold leading-tight">
                    {item.title}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <MobileBottomNav currentTab={currentTab} />
      </div>
    </div>
  );
}
