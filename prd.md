# PRD: Stage Timer (Timer Panggung Jaringan Lokal)

| | |
|---|---|
| Versi | 1.0 |
| Tanggal | 15 Oktober 2026 |
| Pemilik | Hendri |
| Status | Versi awal (MVP) sudah dibuat, siap diuji di lapangan |

---

## 1. Ringkasan

Stage Timer adalah website time keeper untuk acara panggung. Satu PC menjalankan server kecil di jaringan lokal (LAN). Layar panggung hanya membuka halaman **display** yang menampilkan timer. PC lain di jaringan yang sama membuka halaman **kontrol** untuk mengatur timer. Semua perubahan tampil di layar panggung secara langsung, tanpa internet.

## 2. Latar belakang dan masalah

Saat acara, pembicara perlu tahu sisa waktunya, sedangkan operator perlu mengatur timer tanpa terlihat penonton. Aplikasi timer biasa menampilkan kontrol dan angka di layar yang sama, sehingga tidak cocok untuk panggung. Aplikasi stage timer yang ada umumnya berbayar, butuh internet, atau bergantung pada akun cloud.

Kebutuhan inti:
- Layar panggung bersih, hanya timer.
- Kontrol terpisah di PC operator.
- Berjalan sepenuhnya offline di LAN.
- Gratis dan mudah dijalankan oleh operator non-teknis.

## 3. Tujuan dan non-tujuan

**Tujuan**
1. Operator dapat mengatur timer dari PC lain dan perubahan tampil di layar panggung dalam waktu kurang dari 1 detik.
2. Angka timer terbaca jelas dari jarak jauh.
3. Instalasi cukup satu perintah (`node server.js`), tanpa `npm install`.
4. Tetap akurat walau jam tiap PC berbeda atau koneksi sempat putus.

**Non-tujuan (versi 1.0)**
- Akses dari luar jaringan lokal atau lewat internet.
- Akun pengguna, login, dan multi-acara.
- Penyimpanan permanen riwayat timer.
- Aplikasi mobile native (halaman kontrol cukup responsif di browser HP).

## 4. Pengguna

| Peran | Kebutuhan |
|---|---|
| Operator / time keeper | Mengontrol timer, mengirim pesan, mengatur ulang cepat saat acara berjalan |
| Pembicara / MC di panggung | Melihat sisa waktu dan pesan dengan jelas tanpa gangguan |
| Kru teknis (videografer, produksi) | Memasang sistem dengan mudah dan menambah layar display bila perlu |

## 5. Arsitektur

```
 PC Server (Node.js)
 ├── HTTP server (file statis)
 ├── GET  /events    -> SSE, mendorong status ke semua klien
 ├── POST /api/cmd   -> menerima perintah dari kontrol
 └── GET  /api/time  -> kalibrasi jam klien

 PC Operator  -- control.html -->  kirim perintah
 Layar Panggung -- display.html -->  hanya menerima status
```

Prinsip desain:
- **Server sebagai satu-satunya sumber kebenaran.** Status timer disimpan di server, klien hanya menampilkan.
- **Timer berbasis waktu akhir (`endsAt`), bukan hitung mundur per detik.** Setiap klien menghitung sisa waktu dari `endsAt` dikurangi jam server, sehingga tidak melenceng.
- **Kalibrasi jam.** Klien mengukur selisih jam dengan server (5 sampel, dipilih RTT terkecil) dan mengulang tiap 60 detik.
- **SSE, bukan WebSocket.** Cukup untuk alur satu arah server ke klien, tanpa dependensi tambahan, dan reconnect otomatis.
- **Tanpa dependensi.** Hanya modul bawaan Node.js.

## 6. Kebutuhan fungsional

### 6.1 Halaman display (`/display.html`)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| D1 | Menampilkan sisa waktu dalam angka sangat besar (format `MM:SS`, atau `H:MM:SS` bila lebih dari 1 jam) | Wajib |
| D2 | Warna berubah sesuai zona: normal (putih), peringatan (kuning), kritis (merah) | Wajib |
| D3 | Saat waktu habis, muncul tulisan "WAKTU HABIS", timer berkedip dan menghitung waktu lebih dengan tanda minus | Wajib |
| D4 | Progress bar tipis di atas layar sesuai sisa waktu | Wajib |
| D5 | Menampilkan pesan untuk pembicara pada bar kuning di bawah layar | Wajib |
| D6 | Mode layar hitam (blackout) dari kontrol | Wajib |
| D7 | Layar penuh dengan klik atau tombol F; kursor disembunyikan | Wajib |
| D8 | Menjaga layar tetap menyala (Wake Lock) | Sebaiknya |
| D9 | Indikator koneksi terputus (titik merah kecil) | Wajib |
| D10 | Mendukung banyak display sekaligus, semuanya sinkron | Wajib |

### 6.2 Halaman kontrol (`/control.html`)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| C1 | Mulai, jeda, dan reset ke durasi awal | Wajib |
| C2 | Pintasan keyboard: Spasi (mulai/jeda), R (reset), B (layar hitam) | Wajib |
| C3 | Atur durasi manual (menit:detik) dan preset 1, 3, 5, 10, 15, 20, 30, 45, 60 menit | Wajib |
| C4 | Tambah atau kurangi waktu: ±10 detik, ±1 menit, ±5 menit, termasuk saat timer berjalan | Wajib |
| C5 | Kirim pesan bebas (maks. 200 karakter), pesan cepat, dan hapus pesan | Wajib |
| C6 | Toggle layar hitam | Wajib |
| C7 | Atur ambang waktu kuning dan merah (dalam menit) | Wajib |
| C8 | Pilihan jenis font tampilan timer (Modern Sans, Tinggi/Bold, Monospace, Serif, Digital Kalkulator) | Wajib |
| C9 | Preview angka timer dan status (berjalan, dijeda, waktu habis) di halaman kontrol | Wajib |
| C10 | Tombol buka dan salin link display | Sebaiknya |
| C11 | Indikator status koneksi ke server | Wajib |
| C12 | Mendukung banyak kontrol sekaligus (perubahan dari satu kontrol terlihat di kontrol lain) | Wajib |

### 6.3 Server

| ID | Kebutuhan | Prioritas |
|---|---|---|
| S1 | Menyimpan status timer: durasi, sisa, running, endsAt, pesan, blackout, ambang | Wajib |
| S2 | Menyiarkan status ke semua klien lewat SSE setiap ada perubahan | Wajib |
| S3 | Heartbeat tiap 5 detik agar koneksi tetap hidup dan klien tersinkron ulang | Wajib |
| S4 | Mencetak alamat IP LAN kontrol dan display saat server start | Wajib |
| S5 | Port dapat diubah lewat variabel lingkungan `PORT` | Sebaiknya |

## 7. Kebutuhan non-fungsional

- **Latensi:** perubahan dari kontrol tampil di display kurang dari 1 detik di LAN normal.
- **Akurasi:** selisih tampilan antar display di bawah 1 detik meski jam PC berbeda.
- **Keterbacaan:** kontras tinggi (latar hitam, angka terang), ukuran angka menyesuaikan lebar dan tinggi layar.
- **Keandalan:** klien reconnect otomatis; timer yang sedang berjalan tetap akurat setelah reconnect karena memakai `endsAt`.
- **Portabilitas:** Windows, macOS, dan Linux dengan Node.js 16 atau lebih baru; browser modern (Chrome, Edge, Firefox).
- **Aksesibilitas:** fokus keyboard terlihat, animasi kedip dimatikan bila pengguna memilih `prefers-reduced-motion`.
- **Offline:** tidak memuat font, skrip, atau gambar dari internet.

## 8. Alur penggunaan utama

1. Operator menjalankan `node server.js` di PC server dan mencatat alamat yang tampil.
2. Kru membuka `display.html` di PC layar panggung, lalu masuk layar penuh.
3. Operator membuka `control.html` di PC-nya, memilih durasi, lalu menekan **Mulai**.
4. Mendekati akhir, timer berubah kuning lalu merah. Operator dapat mengirim pesan seperti "Segera akhiri".
5. Bila pembicara butuh tambahan waktu, operator menekan **+1 menit**.
6. Setelah sesi selesai, operator menekan **Reset** untuk sesi berikutnya.

## 9. Batasan dan asumsi

- Semua perangkat berada di jaringan yang sama dan firewall mengizinkan port server (default 3000).
- Server hanya menyimpan status di memori. Bila server ditutup, status kembali ke awal.
- Tidak ada autentikasi: siapa pun di jaringan yang sama dan mengetahui alamatnya dapat membuka kontrol. Cocok untuk jaringan acara yang tertutup, tidak untuk jaringan publik.
- Disarankan IP statis untuk PC server agar alamat tidak berubah.

## 10. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| IP PC server berubah (DHCP) | Alamat display dan kontrol tidak valid | IP statis atau reservasi DHCP di router |
| Firewall memblokir port | Perangkat lain tidak bisa terhubung | Izinkan port 3000 di jaringan Private; dokumentasikan di README |
| Wi-Fi acara tidak stabil | Display sempat putus | Gunakan kabel LAN untuk PC display; reconnect otomatis dan indikator titik merah |
| Server tertutup tidak sengaja | Timer reset | Jalankan di PC khusus; roadmap: simpan status ke file |
| Orang lain di jaringan membuka kontrol | Timer diubah pihak tak berwenang | Pakai jaringan tertutup; roadmap: PIN kontrol |
| Browser display masuk mode tidur | Layar mati | Wake Lock, ditambah pengaturan tidur PC dimatikan |

## 11. Kriteria penerimaan (versi 1.0)

- [ ] Kontrol di PC A mengubah display di PC B dalam waktu kurang dari 1 detik.
- [ ] Dua display dan dua kontrol aktif bersamaan, semuanya menunjukkan angka yang sama (selisih di bawah 1 detik).
- [ ] Timer 10 menit berjalan penuh tanpa melenceng lebih dari 1 detik dibanding jam referensi.
- [ ] Warna kuning dan merah muncul tepat pada ambang yang diatur.
- [ ] Setelah Wi-Fi display diputus dan disambung lagi, angka kembali benar tanpa muat ulang halaman.
- [ ] Pesan dan layar hitam dari kontrol langsung tampil di display.
- [ ] Penambahan dan pengurangan waktu bekerja saat timer berjalan maupun dijeda.
- [ ] Instalasi dari nol hanya butuh Node.js dan satu perintah.

## 12. Roadmap (di luar versi 1.0)

| Prioritas | Fitur |
|---|---|
| Tinggi | Rundown: daftar sesi dengan durasi dan tombol "sesi berikutnya" |
| Tinggi | PIN atau token untuk halaman kontrol |
| Sedang | Simpan status ke file agar bertahan saat server restart |
| Sedang | Tampilkan jam sekarang dan nama acara atau logo di display |
| Sedang | Mode hitung naik (count up) dan mode jam |
| Rendah | Bunyi alarm saat waktu habis (di PC kontrol) |
| Rendah | Tema display (ukuran, warna, font) yang bisa diatur |
| Rendah | Daftar perangkat terhubung di halaman kontrol |

## 13. Struktur proyek

```
stage-timer/
├── server.js          # server HTTP + SSE + logika status
├── README.md          # panduan menjalankan
└── public/
    ├── common.js      # sinkronisasi status dan jam, format waktu
    ├── display.html   # tampilan panggung
    └── control.html   # panel operator
```

## 14. Model data status

```json
{
  "durationMs": 600000,
  "remainingMs": 600000,
  "running": false,
  "endsAt": 0,
  "message": "",
  "overText": "WAKTU HABIS",
  "fontFamily": "sans",
  "blackout": false,
  "warnMs": 120000,
  "alertMs": 60000,
  "rev": 0,
  "serverNow": 0
}
```

Perintah yang diterima `POST /api/cmd`: `start`, `pause`, `toggle`, `reset`, `set` (`ms`), `adjust` (`ms`), `message` (`text`), `overText` (`text`), `font` (`font`), `blackout` (`on`), `thresholds` (`warnMs`, `alertMs`).
