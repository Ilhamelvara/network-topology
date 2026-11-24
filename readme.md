# Day 17 - Progressive Web App (PWA)

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![PWA](https://img.shields.io/badge/PWA-Enabled-5A0FC8?style=for-the-badge)

## 📖 Tentang Proyek

**Day 17** adalah aplikasi berbasis web yang dibangun menggunakan Vanilla HTML, CSS, dan JavaScript. Proyek ini sudah dilengkapi dengan konfigurasi **Progressive Web App (PWA)** melalui `manifest.json` dan Service Worker (`sw.js`), memungkinkan aplikasi ini diinstal di perangkat pengguna serta diakses secara *offline*.

> *Catatan: Silakan ganti bagian ini dengan deskripsi spesifik mengenai fungsi utama dari aplikasi Anda (misalnya: aplikasi pencatat keuangan, kalkulator, to-do list, game, dll).*

---

## ✨ Fitur Utama

- **Progressive Web App (PWA):** Dapat diinstal langsung di perangkat mobile maupun desktop (*Add to Home Screen*).
- **Dukungan Offline:** Menggunakan *Service Worker* (`sw.js`) untuk menyimpan aset dalam *cache* sehingga tetap dapat berjalan tanpa koneksi internet.
- **Desain Responsif:** Tampilan antarmuka yang menyesuaikan berbagai ukuran layar menggunakan `style.css`.
- **Logika Interaktif:** Penanganan fitur utama dan interaksi pengguna secara dinamis pada `script.js`.

---

## 📂 Struktur Proyek

Berikut adalah susunan direktori dan file utama dalam proyek ini:

```text
day-17/
├── icons/
│   └── icon.svg        # Ikon vektor aplikasi untuk PWA dan favicon
├── index.html          # Struktur utama halaman web
├── manifest.json       # Konfigurasi metadata PWA (nama, ikon, tema warna, dll.)
├── script.js           # Logika utama aplikasi dan manipulasi DOM
├── style.css           # Styling dan tata letak antarmuka pengguna
└── sw.js               # Service Worker untuk manajemen cache dan mode offline
```

---

## 🚀 Cara Menjalankan Proyek

Karena proyek ini menggunakan Service Worker (PWA), sangat disarankan untuk menjalankannya melalui **Local Web Server** (bukan membuka file `index.html` secara langsung melalui protokol `file://`).

### Opsi 1: Menggunakan VS Code Live Server (Direkomendasikan)
1. Buka folder `day-17` di **Visual Studio Code**.
2. Instal ekstensi **Live Server** jika belum ada.
3. Klik kanan pada file `index.html` dan pilih **Open with Live Server**.

### Opsi 2: Menggunakan Python
Jika Python sudah terinstal di komputer Anda, jalankan perintah berikut di terminal:
```bash
# Masuk ke direktori proyek
cd day-17

# Jalankan server lokal (Python 3)
python -m http.server 8000
```
Kemudian buka browser dan akses `http://localhost:8000`.

### Opsi 3: Menggunakan Node.js (`npx serve`)
```bash
cd day-17
npx serve
```

---

## 🛠️ Teknologi yang Digunakan

- **HTML5** - Struktur semantik web
- **CSS3** - Styling dan responsivitas
- **JavaScript (ES6+)** - Logika aplikasi dan registrasi Service Worker
- **Web App Manifest & Service Workers** - Implementasi fitur PWA

---

## 📝 Lisensi

Proyek ini dibuat untuk tujuan pembelajaran dan pengembangan (*Day 17 Challenge*). Silakan gunakan dan modifikasi sesuai kebutuhan.