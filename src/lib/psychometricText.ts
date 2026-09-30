// Official descriptions from the KPM psychometric report explanation pages
// (Tahun 4 Ujian Aptitud, Tahun 5 IKEP, Tahun 6 Ujian Aptitud).
import type { MiCode } from './intelligence';

export const MI_DESCRIPTIONS: Record<MiCode, string> = {
  VL: 'Keupayaan seseorang individu menggunakan bahasa, memahami maklumat dan memberi respons dalam pelbagai bentuk set komunikasi.',
  LM: 'Keupayaan seseorang individu menggunakan nombor dalam kehidupan seharian untuk membuat penyelesaian secara logikal.',
  INTRA: 'Keupayaan seseorang individu memahami dan menilai kekuatan, kelemahan, bakat dan minat kendiri.',
  VR: 'Bukan Verbal (pintar visual dan ruang); keupayaan seseorang individu mengguna, menganggar dan menginterpretasi ruang.',
  NT: 'Keupayaan seseorang individu mengenalpasti, menghargai alam semulajadi.',
  INTER: 'Keupayaan seseorang individu berkomunikasi, berinteraksi dan bekerjasama dengan orang lain.',
  KN: 'Jasmani (pintar jasmani); keupayaan seseorang individu mengawal dan memahami pergerakan tubuh.',
  MZ: 'Keupayaan seseorang individu menghargai, menghayati dan menggubah muzik.',
  EK: 'Peka dan berkebolehan membincangkan hal-hal kewujudan seperti mencari makna dalam kehidupan.'
};

export const BAHAGIAN_B_TEXT = {
  menaakul: {
    label: 'Kemahiran Menaakul',
    description: 'Keupayaan seseorang individu membuat kesimpulan atau pengitlakan, membuat pertimbangan dari satu situasi umum kepada situasi spesifik, membuat interpretasi, analisis, sintesis atau penilaian bagi suatu situasi atau permasalahan.',
    baik: 'Mempunyai keupayaan membuat kesimpulan atau pengitlakan, membuat pertimbangan dari satu situasi umum kepada situasi spesifik, membuat interpretasi, analisis, sintesis atau penilaian bagi suatu situasi atau permasalahan.',
    kurang: 'Mempunyai keupayaan yang minimum untuk membuat kesimpulan atau pengitlakan, membuat pertimbangan dari satu situasi umum kepada situasi spesifik, membuat interpretasi, analisis, sintesis atau penilaian bagi suatu situasi atau permasalahan.'
  },
  masalah: {
    label: 'Kemahiran Menyelesaikan Masalah',
    description: 'Keupayaan seseorang individu untuk memahami, menganalisis, mensintesis, membuat pertimbangan yang logik, membuat kesimpulan dan membuat keputusan untuk menyelesaikan suatu permasalahan.',
    baik: 'Mempunyai keupayaan untuk memahami, menganalisis, mensintesis, membuat pertimbangan yang logik, membuat kesimpulan dan membuat keputusan untuk menyelesaikan sesuatu permasalahan.',
    kurang: 'Mempunyai keupayaan yang minimum untuk memahami, menganalisis, mensintesis, membuat pertimbangan yang logik, membuat kesimpulan dan membuat keputusan untuk menyelesaikan sesuatu permasalahan.'
  }
} as const;

export const LEVEL_BANDS: Record<'T5_IKEP' | 'T6_APTITUD', string> = {
  T5_IKEP: 'Tinggi 75%–100%, Sederhana 50%–74%, Rendah 0%–49%',
  T6_APTITUD: 'Tinggi 80–100, Sederhana 50–70, Rendah 0–40'
};

export const FORMAT_TITLES = {
  T4_APTITUD: 'Ujian Aptitud Tahun Empat',
  T5_IKEP: 'Inventori Kecerdasan Pelbagai (Sekolah Rendah) (IKEP)',
  T6_APTITUD: 'Ujian Aptitud Tahun Enam'
} as const;
