const GUIDES: Array<{ title: string; steps: string[] }> = [
  { title: 'Isi markah AR atau UASA', steps: [
    'Menu → Pengisian AR / UASA.',
    'Pilih Jenis (AR atau UASA), Tahun, Kelas dan Mata Pelajaran.',
    'Taip markah 0–100. Gred keluar sendiri. Untuk UASA boleh taip gred terus (A–F, TH).',
    'Tekan Simpan. Mesej hijau bermaksud markah sudah disimpan.'
  ] },
  { title: 'Muat naik PDF UASA', steps: [
    'Menu → Import Data → kad Muat Naik UASA.',
    'Pilih Tahun, kemudian Pilih PDF (satu PDF untuk satu kelas).',
    'Semak pratonton. Jika ada murid tidak dipadankan, tambah murid itu dahulu (lihat "Tambah murid").',
    'Tekan Sahkan Import.'
  ] },
  { title: 'Muat naik PDF PBD', steps: [
    'Menu → Import Data → kad Muat Naik PBD.',
    'Pilih Tahun dan Pusingan PBD (PBD 1 / PBD 2).',
    'Pilih PDF, semak pratonton, tekan Sahkan Import.'
  ] },
  { title: 'Lihat senarai murid satu kelas', steps: [
    'Menu → Import Data → kad Kemas Kini Murid.',
    'Pilih Tahun dan Kelas. Semua murid aktif kelas itu dipaparkan.'
  ] },
  { title: 'Tambah murid (murid masuk)', steps: [
    'Menu → Import Data → Kemas Kini Murid → butang Tambah Murid Masuk.',
    'Isi Nama, MyKid dan Kelas. Tekan Tambah ke Roster Aktif.'
  ] },
  { title: 'Keluarkan murid (berpindah)', steps: [
    'Menu → Import Data → Kemas Kini Murid → pilih kelas.',
    'Tekan Keluarkan di sebelah nama murid dan sahkan.',
    'Markah lama murid itu tetap disimpan.'
  ] },
  { title: 'Tambah pusingan AR / aktifkan UASA (Setiausaha)', steps: [
    'Menu → Import Data → kad Tetapan Pusingan.',
    'Pilih Tahun. Tekan Tambah AR seterusnya, atau Aktifkan UASA (sekali setahun).',
    'Pusingan yang ditambah tidak boleh dibuang supaya markah selamat.'
  ] },
  { title: 'Lihat analisis', steps: [
    'Menu → Analisis Akademik.',
    'Pilih tahun, pentaksiran dan mata pelajaran. Trajektori menunjukkan TOV → AR → UASA → ETR.'
  ] },
  { title: 'Cetak slip keputusan murid', steps: [
    'Laman Utama → Semakan → cari murid dengan MyKid.',
    'Tekan butang Cetak pada laporan.'
  ] },
  { title: 'Masalah biasa', steps: [
    '"Murid tidak dapat dipadankan" → murid tiada dalam kelas itu. Tambah murid dahulu, kemudian import semula.',
    '"Sudah ada markah" semasa import → kelas itu sudah diisi. Semak di Pengisian; tidak perlu import lagi.',
    'Tiada AR / UASA dalam senarai → Setiausaha perlu aktifkan di Tetapan Pusingan.',
    'Halaman tidak berubah selepas kemas kini → muat semula halaman (tarik ke bawah di telefon).'
  ] }
];

export function GuidePage() {
  return <>
    <h1 className="import-page-title">Panduan</h1>
    <p className="import-help" style={{ marginBottom: 18 }}>Langkah ringkas untuk setiap tugasan. Semak di sini dahulu sebelum bertanya.</p>
    <div className="guide-list">
      {GUIDES.map((g) => <details key={g.title} className="guide-item">
        <summary>{g.title}</summary>
        <ol>{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      </details>)}
    </div>
  </>;
}
