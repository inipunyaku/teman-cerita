import { api } from './api';
import { fmtDate, todayWib } from './format';
import {
  LIKERT,
  MODE_LABEL,
  SCREENING_ITEMS,
  SCREENING_LEVEL_LABEL,
  TICKET_STATUS_LABEL,
  type Mode,
  type ScreeningLevel,
  type TicketStatus,
} from '@shared/constants';

export interface ScreeningExportRow {
  code: string;
  scheduledStart: string;
  status: TicketStatus;
  mode: Mode;
  employeeName: string;
  employeePn: string | null;
  unitName: string | null;
  psychologistName: string;
  screening: number[];
  screeningScore: number;
  screeningLevel: string;
  noteForClient: string | null;
}

const bold = (value: string) => ({ value, fontWeight: 'bold' as const, wrap: true });

/** Unduh hasil skrining awal & catatan untuk klien (tanpa catatan klinis lain) sebagai .xlsx. */
export async function downloadScreeningExcel(filters: URLSearchParams) {
  const [{ rows }, { default: writeXlsxFile }] = await Promise.all([
    api.get<{ rows: ScreeningExportRow[] }>(`/admin/export/screening?${filters}`),
    import('write-excel-file/browser'),
  ]);
  const header = [
    bold('No'),
    bold('Kode'),
    bold('Jadwal (WIB)'),
    bold('Status'),
    bold('Media'),
    bold('Nama pekerja'),
    bold('PN'),
    bold('Unit kerja'),
    bold('Psikolog'),
    bold('Skor skrining'),
    bold('Kategori skrining'),
    ...SCREENING_ITEMS.map((item, i) => bold(`${i + 1}. ${item.text}`)),
    bold('Catatan untuk klien'),
  ];
  const data = rows.map((r, i) => [
    i + 1,
    r.code,
    fmtDate(r.scheduledStart, 'dd/MM/yyyy HH.mm'),
    TICKET_STATUS_LABEL[r.status] ?? r.status,
    MODE_LABEL[r.mode] ?? r.mode,
    r.employeeName,
    r.employeePn ?? '',
    r.unitName ?? '',
    r.psychologistName,
    r.screeningScore,
    SCREENING_LEVEL_LABEL[r.screeningLevel as ScreeningLevel] ?? r.screeningLevel,
    ...SCREENING_ITEMS.map((_, j) => LIKERT[(r.screening?.[j] ?? 0) - 1] ?? ''),
    { value: r.noteForClient ?? '', wrap: true },
  ]);
  const columns = [
    { width: 5 },
    { width: 14 },
    { width: 17 },
    { width: 16 },
    { width: 12 },
    { width: 26 },
    { width: 12 },
    { width: 24 },
    { width: 24 },
    { width: 9 },
    { width: 11 },
    ...SCREENING_ITEMS.map(() => ({ width: 22 })),
    { width: 50 },
  ];
  await writeXlsxFile([header, ...data], { columns, sheet: 'Skrining', stickyRowsCount: 1 }).toFile(`skrining-teman-cerita-${todayWib()}.xlsx`);
  return rows.length;
}
