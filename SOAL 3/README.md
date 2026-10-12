# Voucher Entri Transaksi Kas Keluar

Purwarupa web untuk membuat, mencari, mengubah, dan menghapus voucher pengeluaran kas. Aplikasi dapat langsung dicoba dalam mode demo (data disimpan di browser) atau dihubungkan ke Supabase Auth dan PostgreSQL.

## Menjalankan aplikasi

1. Pasang Node.js versi 20.19+ atau 22.12+.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env.local`, lalu isi URL proyek Supabase dan publishable/anon key. Biarkan nilainya kosong untuk mode demo.
4. Jalankan `npm run dev` dan buka URL yang ditampilkan Vite.

## Menyiapkan Supabase

1. Buka **SQL Editor** di proyek Supabase dan jalankan seluruh isi [`supabase/schema.sql`](./supabase/schema.sql).
2. Di **Authentication → Users**, buat pengguna untuk masuk ke aplikasi.
3. Atur `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada `.env.local`, lalu mulai ulang server pengembangan.
4. Masuk menggunakan email dan kata sandi pengguna tersebut. Row-level security membatasi setiap pengguna pada voucher miliknya.

Gunakan hanya publishable/anon key pada aplikasi browser—jangan pernah menaruh `service_role` key di frontend. Kebijakan RLS pada skema membatasi baca/tulis per pengguna yang sudah terautentikasi. Mode demo tidak terhubung ke cloud dan datanya hanya tersimpan di browser yang digunakan.

## Fitur

- Ringkasan pengeluaran bulan ini, jumlah voucher, dan rata-rata transaksi.
- Entri voucher dengan nomor otomatis, tanggal, penerima, kategori, akun kas/bank, metode pembayaran, referensi, nominal, dan uraian.
- Pencarian serta filter periode bulan ini, bulan lalu, atau seluruh data.
- Ubah dan hapus voucher; validasi nominal positif dan kolom wajib.
- Login Supabase Auth saat konfigurasi cloud tersedia.
