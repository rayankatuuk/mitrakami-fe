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

## Build APK Android (Capacitor)

Capacitor membungkus hasil build Vite di `dist` ke dalam aplikasi Android. Untuk membuat APK debug, siapkan:

- Node.js sesuai persyaratan di atas dan npm
- JDK 21 (source compatibility modul Capacitor Android 8 memakai Java 21)
- Android SDK dengan Android SDK Platform 36 dan Android SDK Build-Tools terpasang
- `ANDROID_HOME` atau `ANDROID_SDK_ROOT` menunjuk ke Android SDK; pastikan `platform-tools` ada di `PATH`

Setelah prasyarat tersedia, jalankan dari direktori proyek:

```sh
npm install
npm run android:apk
```

APK debug tersedia di `android/app/build/outputs/apk/debug/app-debug.apk`. Untuk membuka proyek di Android Studio, jalankan `npm run android:sync:capacitor` lalu `npm run android:open`.

APK release memerlukan penandatanganan dengan keystore milik penerbit sebelum didistribusikan. Perintah `npm run android:apk:release` membangun varian release yang belum ditandatangani untuk keperluan lokal; jangan distribusikan APK tersebut tanpa konfigurasi signing. Simpan keystore dan kata sandinya di luar repositori, jangan pernah commit keystore atau kredensial.

Mode build Capacitor tidak mendaftarkan service worker PWA di dalam WebView, sehingga caching native tidak bertabrakan dengan cache PWA browser. Mode web reguler tetap mendaftarkan service worker.
