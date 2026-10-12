import { createClient } from '@supabase/supabase-js';
import './style.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const hasPartialConfig = Boolean(SUPABASE_URL || SUPABASE_ANON_KEY) && !isConfigured;
const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const STORAGE_KEY = 'finansi.cash-out-vouchers';
const categories = ['Operasional', 'Perjalanan dinas', 'Perlengkapan kantor', 'Utilitas', 'Gaji & honor', 'Pemasaran', 'Lainnya'];
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
const today = new Date();
const todayISO = toISODate(today);

let vouchers = [];
let session = null;
let periodFilter = 'this-month';
let searchTerm = '';
let editingId = null;
let noticeTimer;

function toISODate(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatDate(value) {
  return value ? dateFormat.format(new Date(`${value}T00:00:00`)) : '—';
}

function sampleVouchers() {
  const date = new Date();
  const month = toISODate(date);
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 25);
  return [
    {
      id: 'demo-1', voucher_no: `KK-${month.slice(0, 7).replace('-', '')}-000128`,
      voucher_date: month, payee: 'PT Sumber Makmur', category: 'Operasional',
      description: 'Pembelian bahan operasional kantor', amount: 2_450_000,
      payment_method: 'Transfer bank', reference_no: 'TRX-820194', account_name: 'Bank BCA · 0091',
      status: 'POSTED',
    },
    {
      id: 'demo-2', voucher_no: `KK-${month.slice(0, 7).replace('-', '')}-000127`,
      voucher_date: month, payee: 'Dina Pratiwi', category: 'Perjalanan dinas',
      description: 'Transportasi dan akomodasi kunjungan klien', amount: 875_000,
      payment_method: 'Transfer bank', reference_no: 'TRX-820163', account_name: 'Bank BCA · 0091',
      status: 'POSTED',
    },
    {
      id: 'demo-3', voucher_no: `KK-${month.slice(0, 7).replace('-', '')}-000126`,
      voucher_date: month, payee: 'Kantor Pos Indonesia', category: 'Utilitas',
      description: 'Tagihan internet dan telepon bulan ini', amount: 1_200_000,
      payment_method: 'Kartu debit', reference_no: 'DB-44821', account_name: 'Bank BCA · 0091',
      status: 'POSTED',
    },
    {
      id: 'demo-4', voucher_no: `KK-${toISODate(previous).slice(0, 7).replace('-', '')}-000099`,
      voucher_date: toISODate(previous), payee: 'Toko Alat Tulis Jaya', category: 'Perlengkapan kantor',
      description: 'ATK dan perlengkapan administrasi', amount: 640_000,
      payment_method: 'Tunai', reference_no: '—', account_name: 'Kas kecil',
      status: 'POSTED',
    },
  ];
}

function readDemoVouchers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
      throw new Error('Format data demo di browser tidak valid.');
    }
  } catch (error) {
    console.error('Gagal membaca data demo dari penyimpanan browser.', error);
    showNotice('Data demo di browser tidak dapat dibaca.', 'error');
  }
  const initial = sampleVouchers();
  try {
    writeDemoVouchers(initial);
  } catch (error) {
    console.error('Gagal menyimpan data demo awal ke penyimpanan browser.', error);
    showNotice('Penyimpanan browser tidak tersedia. Data demo tidak akan tersimpan.', 'error');
  }
  return initial;
}

function writeDemoVouchers(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function icon(name, size = 20) {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    receipt: '<path d="M4 3h16v18l-3-2-3 2-3-2-3 2-4-2z"/><path d="M8 8h8M8 12h8M8 16h4"/>',
    wallet: '<path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6"/><path d="M20 12h-4a2 2 0 0 0 0 4h4z"/><path d="M16 14h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
    bank: '<path d="m3 10 9-7 9 7M4 10h16M6 10v9m4-9v9m4-9v9m4-9v9M3 21h18"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10h.01M18 14h.01"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function shellMarkup() {
  return `
    <aside class="sidebar">
      <a class="brand" href="#" aria-label="Finansi beranda">
        <span class="brand-mark">${icon('chart', 22)}</span>
        <span>finansi<span class="brand-dot">.</span></span>
      </a>
      <div class="workspace-label">WORKSPACE</div>
      <div class="workspace-switch">
        <span class="workspace-avatar">N</span>
        <span class="workspace-copy"><strong>PT Nusa Kreatif</strong><small>Perusahaan</small></span>
        <span class="switch-arrow">${icon('chevron', 16)}</span>
      </div>
      <div class="nav-label">MENU UTAMA</div>
      <nav class="side-nav" aria-label="Navigasi utama">
        <a class="nav-item" href="#" data-nav="overview">${icon('grid', 19)}<span>Ringkasan</span></a>
        <a class="nav-item active" href="#" data-nav="vouchers">${icon('receipt', 19)}<span>Voucher transaksi</span><span class="nav-count" id="nav-count">0</span></a>
        <a class="nav-item" href="#" data-nav="cash">${icon('wallet', 19)}<span>Kas & bank</span></a>
        <a class="nav-item" href="#" data-nav="reports">${icon('chart', 19)}<span>Laporan</span></a>
      </nav>
      <div class="sidebar-bottom">
        <div class="help-card"><span class="help-icon">?</span><strong>Butuh bantuan?</strong><p>Pelajari cara mengelola voucher kas keluar.</p><a href="#panduan">Lihat panduan <span>→</span></a></div>
        <div class="profile">
          <div class="profile-avatar">AR</div>
          <div class="profile-copy"><strong id="profile-name">Admin Rani</strong><small id="profile-email">Finance admin</small></div>
          <button class="icon-button logout-button" id="logout-button" aria-label="Keluar" title="Keluar">${icon('logout', 17)}</button>
        </div>
      </div>
    </aside>
    <main class="main-content">
      <header class="topbar">
        <div class="breadcrumbs"><span>Keuangan</span>${icon('chevron', 14)}<strong>Voucher transaksi</strong></div>
        <div class="topbar-actions">
          <span class="secure-label"><span></span>Data tersimpan aman</span>
          <button class="help-button" id="help-button" aria-label="Bantuan" title="Bantuan">?</button>
        </div>
      </header>
      <section class="page-content">
        <div class="page-heading">
          <div><div class="eyebrow">KEUANGAN <span>/</span> KAS KELUAR</div><h1>Voucher transaksi</h1><p>Catat dan pantau seluruh pengeluaran kas bisnismu.</p></div>
          <button class="primary-button" id="new-voucher-button">${icon('plus', 18)}<span>Buat voucher</span></button>
        </div>
        <div id="connection-banner"></div>
        <section class="summary-grid" aria-label="Ringkasan voucher">
          <article class="summary-card">
            <div class="summary-card-top"><span class="summary-icon purple">${icon('wallet', 19)}</span><span class="period-pill">Bulan ini</span></div>
            <p class="summary-label">Total pengeluaran</p><div class="summary-value" id="total-spend">—</div>
            <div class="summary-foot"><span class="trend-up">${icon('trend', 14)} <b id="spend-count">—</b></span><span>transaksi tercatat</span></div>
          </article>
          <article class="summary-card">
            <div class="summary-card-top"><span class="summary-icon green">${icon('receipt', 19)}</span><span class="summary-period" id="current-month-label"></span></div>
            <p class="summary-label">Voucher terbit</p><div class="summary-value" id="voucher-count">—</div>
            <div class="summary-foot"><span class="soft-dot green-dot"></span><span>Semua voucher terposting</span></div>
          </article>
          <article class="summary-card">
            <div class="summary-card-top"><span class="summary-icon orange">${icon('chart', 19)}</span><span class="summary-period">Per transaksi</span></div>
            <p class="summary-label">Rata-rata pengeluaran</p><div class="summary-value" id="average-spend">—</div>
            <div class="summary-foot"><span>Rata-rata bulan ini</span></div>
          </article>
        </section>
        <section class="transactions-section">
          <div class="section-heading"><div><h2>Riwayat voucher</h2><p>Daftar transaksi kas keluar perusahaan.</p></div><button class="outline-button export-button" id="export-button">${icon('download', 16)}<span>Ekspor</span></button></div>
          <div class="table-toolbar">
            <label class="search-box">${icon('search', 17)}<input id="search-input" type="search" placeholder="Cari voucher atau penerima..." autocomplete="off"><kbd>⌘ K</kbd></label>
            <label class="filter-select">${icon('calendar', 16)}<select id="period-select" aria-label="Filter periode"><option value="this-month">Bulan ini</option><option value="last-month">Bulan lalu</option><option value="all">Semua periode</option></select></label>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>NO. VOUCHER</th><th>TANGGAL</th><th>PENERIMA</th><th>KATEGORI</th><th>METODE</th><th>NOMINAL</th><th>STATUS</th><th><span class="sr-only">Aksi</span></th></tr></thead>
            <tbody id="voucher-rows"></tbody>
          </table>
          <div class="empty-state" id="empty-state" hidden><span class="empty-icon">${icon('receipt', 24)}</span><strong>Belum ada voucher</strong><p>Coba ubah pencarian atau buat voucher baru.</p></div>
          </div>
          <div class="table-footer"><span id="result-count">Menampilkan 0 voucher</span><div class="pagination"><button disabled aria-label="Halaman sebelumnya">‹</button><button class="page-current" aria-label="Halaman 1">1</button><button disabled aria-label="Halaman berikutnya">›</button></div></div>
        </section>
        <footer class="page-footer"><span>© 2025 Finansi. Keuangan lebih rapi, bisnis lebih berarti.</span><span>Butuh bantuan? <a href="#panduan">Kunjungi pusat bantuan</a></span></footer>
      </section>
    </main>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <div class="modal-backdrop" id="modal-backdrop" hidden>
      <section class="voucher-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header"><div><span class="modal-kicker">KAS KELUAR</span><h2 id="modal-title">Buat voucher baru</h2><p>Lengkapi detail pengeluaran kas berikut.</p></div><button class="icon-button close-modal" id="close-modal" aria-label="Tutup">${icon('close', 19)}</button></div>
        <form id="voucher-form">
          <div class="form-grid">
            <label class="field"><span>Tanggal transaksi <i>*</i></span><input name="voucher_date" type="date" value="${todayISO}" required></label>
            <label class="field"><span>Penerima <i>*</i></span><input name="payee" maxlength="120" placeholder="Nama penerima atau vendor" required></label>
            <label class="field"><span>Kategori <i>*</i></span><select name="category" required>${categories.map(category => `<option>${escapeHtml(category)}</option>`).join('')}</select></label>
            <label class="field"><span>Akun kas / bank <i>*</i></span><input name="account_name" maxlength="100" placeholder="Contoh: Bank BCA · 0091" required></label>
            <label class="field"><span>Metode pembayaran <i>*</i></span><select name="payment_method" required><option>Transfer bank</option><option>Tunai</option><option>Kartu debit</option></select></label>
            <label class="field"><span>No. referensi <small>Opsional</small></span><input name="reference_no" maxlength="80" placeholder="No. transaksi / bukti"></label>
            <label class="field field-full"><span>Nominal pengeluaran <i>*</i></span><div class="amount-input"><span>Rp</span><input name="amount" type="number" min="1" step="1" placeholder="0" required></div></label>
            <label class="field field-full"><span>Uraian transaksi <i>*</i></span><textarea name="description" rows="3" maxlength="500" placeholder="Jelaskan tujuan pengeluaran..." required></textarea></label>
          </div>
          <div class="modal-footer"><span><i>*</i> Wajib diisi</span><div><button type="button" class="outline-button" id="cancel-modal">Batal</button><button type="submit" class="primary-button submit-button" id="submit-button">${icon('check', 17)}<span>Simpan voucher</span></button></div></div>
        </form>
      </section>
    </div>`;
}

function loginMarkup() {
  return `<main class="login-screen"><div class="login-card"><a class="brand login-brand" href="#"><span class="brand-mark">${icon('chart', 22)}</span><span>finansi<span class="brand-dot">.</span></span></a><div class="eyebrow">RUANG KERJA KEUANGAN</div><h1>Selamat datang kembali</h1><p>Masuk untuk mengelola voucher kas keluar perusahaan.</p><form id="login-form"><label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" placeholder="nama@perusahaan.com" required></label><label class="field"><span>Kata sandi</span><input name="password" type="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required></label><button class="primary-button login-submit" type="submit"><span>Masuk ke akun</span>${icon('chevron', 17)}</button></form><div class="login-note">Belum punya akun? Buat pengguna melalui Supabase Authentication.</div><div class="login-error" id="login-error" role="alert"></div></div><span class="login-copyright">© 2025 Finansi · Voucher transaksi kas keluar</span></main>`;
}

function renderApp() {
  document.querySelector('#app').innerHTML = isConfigured && !session ? loginMarkup() : shellMarkup();
  if (isConfigured && !session) {
    document.querySelector('#login-form').addEventListener('submit', handleLogin);
    return;
  }

  document.querySelector('#connection-banner').innerHTML = isConfigured
    ? `<div class="connection-banner cloud-banner"><span class="connection-indicator"></span><span>Terhubung ke Supabase</span><span class="banner-divider">·</span><span>${escapeHtml(session?.user?.email || 'Akun terautentikasi')}</span></div>`
    : hasPartialConfig
      ? '<div class="connection-banner demo-banner"><span class="connection-indicator"></span><strong>Konfigurasi Supabase belum lengkap</strong><span>Isi URL proyek dan anon key di .env.local. Saat ini data hanya tersimpan di browser.</span><a href="#panduan">Lihat panduan →</a></div>'
      : '<div class="connection-banner demo-banner"><span class="connection-indicator"></span><strong>Mode demo</strong><span>Data disimpan di browser ini, belum terhubung ke Supabase.</span><a href="#panduan">Cara menghubungkan →</a></div>';
  document.querySelector('#current-month-label').textContent = monthFormat.format(today);
  document.querySelector('#period-select').value = periodFilter;
  if (session?.user?.email) {
    document.querySelector('#profile-name').textContent = session.user.email.split('@')[0];
    document.querySelector('#profile-email').textContent = session.user.email;
  }
  document.querySelector('#new-voucher-button').addEventListener('click', () => openModal());
  document.querySelector('#close-modal').addEventListener('click', closeModal);
  document.querySelector('#cancel-modal').addEventListener('click', closeModal);
  document.querySelector('#modal-backdrop').addEventListener('click', event => {
    if (event.target.id === 'modal-backdrop') closeModal();
  });
  document.querySelector('#voucher-form').addEventListener('submit', handleVoucherSubmit);
  document.querySelector('#search-input').addEventListener('input', event => {
    searchTerm = event.target.value.trim().toLowerCase();
    renderTable();
  });
  document.querySelector('#period-select').addEventListener('change', event => {
    periodFilter = event.target.value;
    renderTable();
  });
  document.querySelector('#export-button').addEventListener('click', exportVouchers);
  document.querySelector('#logout-button').addEventListener('click', handleLogout);
  document.querySelector('#help-button').addEventListener('click', () => showNotice('Siapkan Supabase melalui panduan di README.md.', 'info'));
  renderVouchers();
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const error = document.querySelector('#login-error');
  button.disabled = true;
  error.textContent = '';
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: form.get('email'),
    password: form.get('password'),
  });
  button.disabled = false;
  if (loginError) {
    error.textContent = `Gagal masuk: ${loginError.message}`;
    return;
  }
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();
  if (error) showNotice(`Gagal keluar: ${error.message}`, 'error');
}

async function loadVouchers() {
  const { data, error } = await supabase
    .from('cash_out_vouchers')
    .select('id, voucher_no, voucher_date, payee, category, description, amount, payment_method, reference_no, account_name, status')
    .order('voucher_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  vouchers = data;
  renderVouchers();
}

async function renderVouchers() {
  if (!isConfigured) {
    vouchers = readDemoVouchers();
    renderSummary();
    renderTable();
    return;
  }
  try {
    await loadVouchers();
  } catch (error) {
    console.error('Gagal memuat voucher dari Supabase.', error);
    vouchers = [];
    renderSummary();
    renderTable();
    showNotice(`Tidak dapat memuat voucher: ${error.message}`, 'error');
  }
}

function getThisMonthVouchers() {
  const month = todayISO.slice(0, 7);
  return vouchers.filter(voucher => voucher.voucher_date?.startsWith(month) && voucher.status !== 'VOID');
}

function renderSummary() {
  const monthly = getThisMonthVouchers();
  const total = monthly.reduce((sum, voucher) => sum + Number(voucher.amount), 0);
  document.querySelector('#nav-count').textContent = vouchers.length;
  document.querySelector('#total-spend').textContent = money.format(total);
  document.querySelector('#spend-count').textContent = monthly.length;
  document.querySelector('#voucher-count').textContent = vouchers.filter(voucher => voucher.status !== 'VOID').length;
  document.querySelector('#average-spend').textContent = money.format(monthly.length ? total / monthly.length : 0);
}

function getFilteredVouchers() {
  const now = new Date();
  const thisMonth = todayISO.slice(0, 7);
  const lastMonth = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  return vouchers.filter(voucher => {
    const month = voucher.voucher_date?.slice(0, 7);
    const matchesPeriod = periodFilter === 'all'
      || (periodFilter === 'this-month' && month === thisMonth)
      || (periodFilter === 'last-month' && month === lastMonth);
    const haystack = `${voucher.voucher_no} ${voucher.payee} ${voucher.category} ${voucher.description}`.toLowerCase();
    return matchesPeriod && haystack.includes(searchTerm);
  });
}

function renderTable() {
  const filtered = getFilteredVouchers();
  const rows = document.querySelector('#voucher-rows');
  rows.innerHTML = filtered.map(voucher => {
    const isVoid = voucher.status === 'VOID';
    const paymentIcon = voucher.payment_method === 'Tunai' ? 'cash' : 'bank';
    return `<tr>
      <td><span class="voucher-number">${escapeHtml(voucher.voucher_no)}</span></td>
      <td class="date-cell">${formatDate(voucher.voucher_date)}</td>
      <td><div class="payee-cell"><span class="payee-avatar">${escapeHtml(voucher.payee.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(voucher.payee)}</strong><small>${escapeHtml(voucher.description)}</small></span></div></td>
      <td><span class="category-tag">${escapeHtml(voucher.category)}</span></td>
      <td><span class="payment-cell">${icon(paymentIcon, 15)}${escapeHtml(voucher.payment_method)}</span></td>
      <td class="amount-cell">${money.format(Number(voucher.amount))}</td>
      <td><span class="status-badge ${isVoid ? 'status-void' : ''}"><span></span>${isVoid ? 'Dibatalkan' : 'Terposting'}</span></td>
      <td><div class="row-actions"><button class="icon-button row-action" data-action="edit" data-id="${escapeHtml(voucher.id)}" aria-label="Ubah voucher ${escapeHtml(voucher.voucher_no)}" title="Ubah">${icon('edit', 16)}</button><button class="icon-button row-action delete-action" data-action="delete" data-id="${escapeHtml(voucher.id)}" aria-label="Hapus voucher ${escapeHtml(voucher.voucher_no)}" title="Hapus">${icon('trash', 16)}</button></div></td>
    </tr>`;
  }).join('');
  rows.querySelectorAll('[data-action="edit"]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.id)));
  rows.querySelectorAll('[data-action="delete"]').forEach(button => button.addEventListener('click', () => deleteVoucher(button.dataset.id)));
  document.querySelector('#empty-state').hidden = filtered.length > 0;
  document.querySelector('#result-count').textContent = `Menampilkan ${filtered.length} dari ${vouchers.length} voucher`;
}

function openModal(id = null) {
  const form = document.querySelector('#voucher-form');
  form.reset();
  form.elements.voucher_date.value = todayISO;
  editingId = id;
  if (id) {
    const voucher = vouchers.find(item => item.id === id);
    if (!voucher) return;
    for (const field of ['voucher_date', 'payee', 'category', 'account_name', 'payment_method', 'reference_no', 'amount', 'description']) {
      form.elements[field].value = voucher[field] ?? '';
    }
    document.querySelector('#modal-title').textContent = 'Ubah voucher';
  } else {
    document.querySelector('#modal-title').textContent = 'Buat voucher baru';
  }
  document.querySelector('#modal-backdrop').hidden = false;
  document.body.classList.add('modal-open');
  form.elements.payee.focus();
}

function closeModal() {
  document.querySelector('#modal-backdrop').hidden = true;
  document.body.classList.remove('modal-open');
  editingId = null;
}

async function handleVoucherSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.querySelector('#submit-button');
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.amount = Number(payload.amount);
  payload.reference_no = payload.reference_no.trim() || null;
  const isEditing = Boolean(editingId);
  button.disabled = true;
  button.querySelector('span').textContent = 'Menyimpan...';

  try {
    if (isConfigured) {
      const query = isEditing
        ? supabase.from('cash_out_vouchers').update(payload).eq('id', editingId)
        : supabase.from('cash_out_vouchers').insert(payload);
      const { error } = await query;
      if (error) throw error;
    } else {
      const existing = isEditing ? vouchers.find(voucher => voucher.id === editingId) : null;
      const voucher = {
        ...payload,
        id: existing?.id || `demo-${Date.now()}`,
        voucher_no: existing?.voucher_no || makeDemoVoucherNumber(payload.voucher_date),
        status: existing?.status || 'POSTED',
      };
      vouchers = isEditing
        ? vouchers.map(item => item.id === editingId ? voucher : item)
        : [voucher, ...vouchers];
      writeDemoVouchers(vouchers);
    }
    closeModal();
    showNotice(isEditing ? 'Voucher berhasil diperbarui.' : 'Voucher berhasil disimpan.', 'success');
    await renderVouchers();
  } catch (error) {
    console.error('Gagal menyimpan voucher.', error);
    showNotice(`Voucher gagal disimpan: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Simpan voucher';
  }
}

function makeDemoVoucherNumber(date) {
  const month = date.slice(0, 7).replace('-', '');
  const serial = String(vouchers.filter(voucher => voucher.voucher_no.includes(month)).length + 1).padStart(6, '0');
  return `KK-${month}-${serial}`;
}

async function deleteVoucher(id) {
  const voucher = vouchers.find(item => item.id === id);
  if (!voucher || !window.confirm(`Hapus voucher ${voucher.voucher_no}? Tindakan ini tidak dapat dibatalkan.`)) return;
  try {
    if (isConfigured) {
      const { error } = await supabase.from('cash_out_vouchers').delete().eq('id', id);
      if (error) throw error;
    } else {
      vouchers = vouchers.filter(item => item.id !== id);
      writeDemoVouchers(vouchers);
    }
    showNotice('Voucher berhasil dihapus.', 'success');
    await renderVouchers();
  } catch (error) {
    console.error('Gagal menghapus voucher.', error);
    showNotice(`Voucher gagal dihapus: ${error.message}`, 'error');
  }
}

function exportVouchers() {
  const rows = getFilteredVouchers();
  if (!rows.length) {
    showNotice('Tidak ada voucher untuk diekspor.', 'info');
    return;
  }
  const columns = ['Nomor voucher', 'Tanggal', 'Penerima', 'Kategori', 'Uraian', 'Nominal', 'Metode pembayaran', 'Akun kas/bank', 'No. referensi', 'Status'];
  const values = rows.map(item => [
    item.voucher_no, item.voucher_date, item.payee, item.category, item.description,
    item.amount, item.payment_method, item.account_name, item.reference_no || '', item.status,
  ]);
  const csv = [columns, ...values].map(row => row.map(value => {
    let cell = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `voucher-kas-keluar-${todayISO}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function showNotice(message, type = 'info') {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  clearTimeout(noticeTimer);
  toast.textContent = message;
  toast.className = `toast toast-${type} visible`;
  noticeTimer = setTimeout(() => toast.classList.remove('visible'), 4200);
}

async function init() {
  if (!isConfigured) {
    renderApp();
    return;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Gagal memeriksa sesi Supabase.', error);
    document.querySelector('#app').innerHTML = `<main class="login-screen"><div class="login-card"><h1>Koneksi Supabase bermasalah</h1><p>${escapeHtml(error.message)}</p></div></main>`;
    return;
  }
  session = data.session;
  renderApp();
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    if (nextSession?.access_token === session?.access_token) return;
    session = nextSession;
    setTimeout(renderApp, 0);
  });
}

document.querySelector('#app').innerHTML = '<div class="loading-screen"><span class="loading-mark">f.</span><span>Menyiapkan ruang kerja...</span></div>';
init();
