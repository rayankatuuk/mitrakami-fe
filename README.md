# MitraKami SuperApp

Frontend MitraKami SuperApp dibangun menggunakan React, Vite, dan React Router. Aplikasi ini menyediakan fitur akun member, saldo, transaksi, pembayaran PPOB, penerbangan, dan reservasi hotel.

## Persyaratan

- Node.js 20.19+ atau 22.12+
- npm
- URL API backend MitraKami

## Menjalankan aplikasi

```sh
npm install
npm run dev
```

Buat berkas `.env` lokal dan isi URL API backend:

```dotenv
VITE_PRIME_API_BASE_URL=https://api.example.com
```

Nilai URL harus menunjuk ke host API yang sesuai dengan deployment. Jangan menyimpan kredensial rahasia di variabel `VITE_*`, karena nilainya disertakan ke bundle browser.

## Pemeriksaan dan build

```sh
npm run lint
npm run build
npm run preview
```

Build produksi dibuat di direktori `dist`. Konfigurasi PWA, manifest, dan service worker berada di `vite.config.js`; aset publik berada di `public`.
