import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthSession, updateAuthSession } from "../utils/authStorage";
import { mitrakamiApi } from "../services/mitrakamiApi";
import { buildApiUrl } from "../services/apiClient";
import MobileBottomNav from "../components/MobileBottomNav";
import { resolvePackageAvatarPath } from "../utils/memberPackageAvatar";
import AppIcon from "../components/AppIcon";
import {
  normalizeTopUpHistoryTransaction,
  resolveTopUpHistoryRoute,
} from "../utils/topupHistoryMapper";
import { Bell, Plus, ScanLine } from "lucide-react";
import "./DashboardPage.css";

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
const transactionDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatTransactionDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : transactionDateFormatter.format(date);
};

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
  const [recentTransaction, setRecentTransaction] = useState(null);
  const hasTriedRealtimeSync = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    mitrakamiApi.getTransactionHistory({ month, filter_type: "all", page: 1 })
      .then((payload) => {
        const transactions = Array.isArray(payload?.transactions) ? payload.transactions : [];
        if (isMounted) setRecentTransaction(transactions[0] ?? null);
      })
      .catch(() => {
        if (isMounted) setRecentTransaction(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleRecentTransactionClick = () => {
    if (!recentTransaction) return;
    const topUpTransaction = normalizeTopUpHistoryTransaction(recentTransaction);

    if (topUpTransaction) {
      navigate(resolveTopUpHistoryRoute(topUpTransaction.status), {
        state: { from: "/app/history", transaction: topUpTransaction },
      });
      return;
    }

    if (recentTransaction.id && recentTransaction.reference) {
      navigate("/app/history/transaction", {
        state: { from: "/app/history", transaction: recentTransaction },
      });
    } else {
      navigate("/app/history");
    }
  };

  const recentTransactionStatus = String(recentTransaction?.status || "").toLowerCase();
  const recentStatusLabel = {
    success: "Berhasil",
    pending: "Diproses",
    failed: "Gagal",
  }[recentTransactionStatus] || recentTransaction?.status || "-";
  const recentTransactionLabel = `${recentTransaction?.category || ""} ${recentTransaction?.title || ""}`.toLowerCase();
  const recentTransactionIcon = recentTransactionLabel.includes("pulsa")
    ? "smartphone"
    : recentTransactionLabel.includes("transfer")
      ? "swap_vert"
      : "receipt_long";

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <header className="dashboard-hero">
          <div className="dashboard-hero-sweep" aria-hidden="true" />
          <div className="dashboard-header-row">
            <div className="dashboard-member">
              <div className="dashboard-avatar-wrap">
                <img src={displayAvatar} alt="Foto profil" className="dashboard-avatar" />
                <span className="dashboard-online-dot" />
              </div>
              <div className="dashboard-member-copy">
                <p>Halo,</p>
                <h1>{displayName}</h1>
                <span className="dashboard-member-badge">♛ {displayPackage}</span>
              </div>
            </div>

            <div className="dashboard-brand-tools">
              <div className="dashboard-wordmark" aria-label="MitraKami SuperApp">
                <span className="dashboard-brand-mark" aria-hidden="true">M<span>K</span></span>
                <span className="dashboard-brand-name">Mitra<span>Kami</span></span>
                <small>SUPERAPP</small>
              </div>
              <div className="dashboard-utility-icons" aria-hidden="true">
                <span className="dashboard-notification-icon"><Bell size={22} strokeWidth={2} /><i>3</i></span>
                <ScanLine size={24} strokeWidth={2} />
              </div>
            </div>
          </div>
          <p className="dashboard-motto">Bersama MitraKami, Membangun Indonesia</p>
        </header>

        <section className="dashboard-balance-card" aria-label="Informasi saldo">
          <div className="dashboard-balance-top">
            <div className="dashboard-balance-icon"><AppIcon name="account_balance_wallet" /></div>
            <div className="dashboard-balance-copy">
              <div className="dashboard-balance-label">
                <span>Saldo MitraKami</span>
                <button
                  type="button"
                  onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                  aria-label={isBalanceVisible ? "Hide balance" : "Show balance"}
                >
                  <AppIcon name={isBalanceVisible ? "visibility" : "visibility_off"} />
                </button>
              </div>
              <h2>{isBalanceVisible ? formatCurrency(displayBalance) : "Rp ******"}</h2>
            </div>
            <button className="dashboard-topup-button" type="button" onClick={() => navigate('/app/topup')}>
              <Plus /> Top Up
            </button>
          </div>

          <div className="dashboard-shortcuts" aria-label="Akses cepat">
            {[
              { label: 'Transfer', icon: 'swap_vert', route: '/app/transfer' },
              { label: 'Riwayat', icon: 'history', route: '/app/history' },
              { label: 'Voucher', icon: 'local_offer', route: '/app/voucher-games' },
              { label: 'MitraPoints', icon: 'crown', route: '/app/account' },
            ].map((item) => (
              <button key={item.label} type="button" onClick={() => navigate(item.route)}>
                <span><AppIcon name={item.icon} /></span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="dashboard-content">
          <section className="dashboard-support-banner" aria-label="Dukung UMKM Indonesia">
            <div className="dashboard-support-copy">
              <strong>DUKUNG<br />UMKM INDONESIA</strong>
              <p>Belanja Produk Lokal,<br />Bangun Ekonomi Bangsa.</p>
              <span>Mulai Belanja <AppIcon name="arrow_forward" /></span>
            </div>
            <div className="dashboard-support-landscape" aria-hidden="true">
              <span>🇮🇩</span>
              <i />
            </div>
          </section>

          <section className="dashboard-section dashboard-services">
            <div className="dashboard-section-heading">
              <h2>Layanan Favorit</h2>
              <span>Lihat Semua <AppIcon name="chevron_right" /></span>
            </div>
            <div className="dashboard-service-grid">
              {PAYMENT_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handlePaymentItemClick(item)}
                  className={`dashboard-service-item ${item.bg}`}
                >
                  <span className="dashboard-service-icon">
                    <AppIcon name={item.icon} className={item.color} />
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="dashboard-section dashboard-promo-section" aria-label="Promo spesial MitraKami">
            <div className="dashboard-section-heading">
              <h2>Promo Spesial</h2>
              <span>Lihat Semua <AppIcon name="chevron_right" /></span>
            </div>
            <div className="dashboard-promo-banner" aria-label="Promo cashback MitraKami">
              <div className="dashboard-promo-offer"><strong>CASHBACK<br />HINGGA <b>50%</b></strong></div>
              <div className="dashboard-promo-copy">Transaksi lebih hemat<br />untuk kebutuhan sehari-hari</div>
              <span className="dashboard-promo-cta">Lihat Promo <AppIcon name="arrow_forward" /></span>
              <div className="dashboard-promo-illustration" aria-hidden="true">
                <span className="dashboard-promo-phone">MK</span>
                <span className="dashboard-promo-gift" />
                <span className="dashboard-promo-tag">%</span>
              </div>
            </div>
          </section>

          <section className="dashboard-section dashboard-recent-section" aria-label="Transaksi terakhir">
            <div className="dashboard-section-heading">
              <h2>Transaksi Terakhir</h2>
              <button type="button" className="dashboard-see-all" onClick={() => navigate("/app/history")}>
                Lihat Semua <AppIcon name="chevron_right" />
              </button>
            </div>
            {recentTransaction ? (
              <button type="button" className="dashboard-recent-card" onClick={handleRecentTransactionClick}>
                <span className="dashboard-recent-icon"><AppIcon name={recentTransactionIcon} /></span>
                <span className="dashboard-recent-details">
                  <strong>{recentTransaction.title || recentTransaction.category_label || "Transaksi"}</strong>
                  <span>{recentTransaction.counterparty || recentTransaction.category_label || "Transaksi MitraKami"}</span>
                  <small>{formatTransactionDate(recentTransaction.created_at || recentTransaction.createdAt)}</small>
                </span>
                <span className="dashboard-recent-summary">
                  <strong>{formatCurrency(recentTransaction.amount ?? recentTransaction.totalAmount ?? 0)}</strong>
                  <small className={`dashboard-recent-status is-${recentTransactionStatus || "unknown"}`}>
                    <AppIcon name={recentTransactionStatus === "success" ? "check_circle" : "schedule"} />
                    {recentStatusLabel}
                  </small>
                </span>
                <AppIcon name="chevron_right" className="dashboard-recent-chevron" />
              </button>
            ) : (
              <div className="dashboard-recent-empty">Belum ada transaksi bulan ini.</div>
            )}
          </section>

          <section className="dashboard-section dashboard-store-section">
            <div className="dashboard-section-heading">
              <h2>Mitra UMKM</h2>
              <button type="button" className="dashboard-see-all">
                Lihat Semua <AppIcon name="chevron_right" />
              </button>
            </div>
            <div className="dashboard-store-list no-scrollbar">
              {STORE_ITEMS.map((item) => (
                <article key={item.title} className="dashboard-store-card">
                  <img src={item.image} alt={item.title} />
                  <div className="dashboard-store-shade" />
                  <button type="button" className="dashboard-favorite" aria-label="Favorite">
                    <AppIcon name="favorite_border" />
                  </button>
                  {item.badge && (
                    <span className={`dashboard-store-badge ${item.badgeClass ?? ''}`}>
                      {item.badge}
                    </span>
                  )}
                  <div className="dashboard-store-copy">
                    <p>{item.category}</p>
                    <h3>{item.title}</h3>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <MobileBottomNav currentTab={currentTab} />
      </div>
    </main>
  );
}
