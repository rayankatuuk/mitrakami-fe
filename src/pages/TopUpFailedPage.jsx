import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  normalizeTopUpHistoryTransaction,
  TOPUP_STATUSES,
} from "../utils/topupHistoryMapper";
import AppIcon from "../components/AppIcon";

const HOME_ROUTE = "/app/home";
const HISTORY_ROUTE = "/app/history";

const FAILED_REASON_LABELS = {
  cancelled_by_member: "Top up dibatalkan oleh pengguna.",
  expired: "Batas waktu pembayaran telah berakhir.",
};

const formatCurrency = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const formatDateTime = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TopUpFailedPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const transaction = useMemo(
    () => normalizeTopUpHistoryTransaction(location.state?.transaction),
    [location.state?.transaction],
  );

  const isValidFailed = transaction?.status === TOPUP_STATUSES.failed;
  const failedReasonText =
    FAILED_REASON_LABELS[transaction?.failedReason] ||
    "Transaksi top up tidak dapat diproses.";

  if (!isValidFailed) {
    return (
      <div className="min-h-screen bg-background-app text-text-primary">
        <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden px-5 pt-16 pb-8">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft text-center">
            <h1 className="text-xl font-bold mb-2">
              Data transaksi tidak ditemukan
            </h1>
            <p className="text-sm text-text-secondary mb-5">
              Silakan kembali ke halaman riwayat untuk melihat detail transaksi
              top up.
            </p>
            <button
              type="button"
              onClick={() => navigate(HISTORY_ROUTE, { replace: true })}
              className="w-full rounded-2xl bg-primary text-white font-bold py-3"
            >
              Kembali ke Riwayat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-8">
        <header className="bg-primary text-white px-5 pt-12 pb-8 shadow-md">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(HISTORY_ROUTE, { replace: true })}
              className="size-9 rounded-full bg-white/15 grid place-items-center"
              aria-label="Kembali"
            >
              <AppIcon name="arrow_back_ios_new" className="size-5" />
            </button>
            <h1 className="text-xl font-bold">Status Transaksi</h1>
            <span className="size-9" />
          </div>
        </header>

        <main className="px-5 pt-7">
          <div className="size-20 mx-auto mb-6 rounded-full bg-red-100 grid place-items-center">
            <AppIcon name="cancel" className="size-24 text-red-500" />
          </div>

          <h2 className="text-3xl font-bold text-center mb-3">Top Up Gagal</h2>
          <p className="text-center text-text-secondary text-lg leading-relaxed mb-7">
            {failedReasonText}
          </p>

          <section className="rounded-3xl bg-white border border-black/5 shadow-soft p-5 mb-8">
            <div className="text-center border-b border-black/5 pb-4 mb-4">
              <p className="text-text-secondary text-sm mb-2">Total Top Up</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(transaction.totalAmount)}
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Tanggal</span>
                <span className="font-semibold text-right">
                  {formatDateTime(transaction.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Metode Pembayaran</span>
                <span className="font-semibold text-right">
                  {transaction.bankName || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">No. Referensi</span>
                <span className="font-semibold text-right break-all">
                  {transaction.reference}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Status</span>
                <span className="font-semibold text-right text-red-500">
                  Gagal
                </span>
              </div>
            </div>
          </section>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate(HISTORY_ROUTE, { replace: true })}
              className="w-full rounded-2xl border-2 border-primary text-primary font-bold py-3.5"
            >
              Lihat Riwayat Transaksi
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
