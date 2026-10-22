import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchText, Pagination, usePaged } from '@/components/table';

afterEach(cleanup);

describe('matchText', () => {
  it('tanpa kata kunci selalu cocok', () => {
    expect(matchText('', 'apa')).toBe(true);
    expect(matchText('   ')).toBe(true);
  });
  it('tidak membedakan huruf besar/kecil & mengabaikan null', () => {
    expect(matchText('VAN', null, undefined, 'Vanda')).toBe(true);
    expect(matchText(' anda ', 'Vanda')).toBe(true);
    expect(matchText('xyz', null, 'Vanda')).toBe(false);
    expect(matchText('12', 3412)).toBe(true);
    expect(matchText('0', 0)).toBe(true);
  });
});

describe('usePaged', () => {
  const items = Array.from({ length: 45 }, (_, i) => i + 1);

  it('memotong per halaman & menghitung total', () => {
    const { result } = renderHook(() => usePaged(items, '', 20));
    expect(result.current).toMatchObject({ page: 1, pageSize: 20, total: 45 });
    expect(result.current.pageItems).toEqual(items.slice(0, 20));
    act(() => result.current.setPage(3));
    expect(result.current.pageItems).toEqual([41, 42, 43, 44, 45]);
  });

  it('tidak melewati halaman terakhir saat data menyusut', () => {
    const { result, rerender } = renderHook(({ list }) => usePaged(list, 'k', 10), { initialProps: { list: items } });
    act(() => result.current.setPage(5));
    expect(result.current.page).toBe(5);
    rerender({ list: items.slice(0, 12) });
    expect(result.current.page).toBe(2);
    expect(result.current.pageItems).toEqual([11, 12]);
    rerender({ list: [] });
    expect(result.current).toMatchObject({ page: 1, pageItems: [], total: 0 });
  });

  it('kembali ke halaman 1 saat resetKey atau pageSize berubah', () => {
    const { result, rerender } = renderHook(({ key }) => usePaged(items, key, 10), { initialProps: { key: 'a' } });
    act(() => result.current.setPage(3));
    rerender({ key: 'b' });
    expect(result.current.page).toBe(1);
    act(() => result.current.setPage(2));
    act(() => result.current.setPageSize(20));
    expect(result.current).toMatchObject({ page: 1, pageSize: 20 });
  });
});

describe('Pagination', () => {
  it('kosong saat total 0', () => {
    const { container } = render(<Pagination page={1} pageSize={20} total={0} onPage={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('keterangan rentang & tombol nonaktif di ujung', () => {
    const onPage = vi.fn();
    render(<Pagination page={1} pageSize={20} total={45} onPage={onPage} unit="sesi" />);
    expect(screen.getByRole('navigation').textContent).toContain('Menampilkan 1–20 dari 45 sesi');
    expect(screen.getByLabelText('Halaman sebelumnya')).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByLabelText('Halaman berikutnya'));
    expect(onPage).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onPage).toHaveBeenLastCalledWith(3);
    expect(screen.getByRole('button', { name: '1' }).getAttribute('aria-current')).toBe('page');
  });

  it('halaman terakhir & satu halaman tanpa tombol', () => {
    const { rerender } = render(<Pagination page={3} pageSize={20} total={45} onPage={() => {}} />);
    expect(screen.getByRole('navigation').textContent).toContain('41–45 dari 45');
    expect(screen.getByLabelText('Halaman berikutnya')).toHaveProperty('disabled', true);
    rerender(<Pagination page={1} pageSize={20} total={5} onPage={() => {}} />);
    expect(screen.queryByLabelText('Halaman berikutnya')).toBeNull();
  });

  it('nomor halaman ringkas dengan elipsis', () => {
    const nums = () => screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t && /^\d+$/.test(t));
    const { rerender } = render(<Pagination page={1} pageSize={10} total={370} onPage={() => {}} />);
    expect(nums()).toEqual(['1', '2', '3', '4', '5', '37']);
    rerender(<Pagination page={10} pageSize={10} total={370} onPage={() => {}} />);
    expect(nums()).toEqual(['1', '9', '10', '11', '37']);
    rerender(<Pagination page={35} pageSize={10} total={370} onPage={() => {}} />);
    expect(nums()).toEqual(['1', '33', '34', '35', '36', '37']);
    rerender(<Pagination page={2} pageSize={10} total={70} onPage={() => {}} />);
    expect(nums()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('pilihan baris per halaman', () => {
    const onPageSize = vi.fn();
    render(<Pagination page={1} pageSize={20} total={45} onPage={() => {}} onPageSize={onPageSize} />);
    fireEvent.change(screen.getByLabelText('Baris per halaman'), { target: { value: '50' } });
    expect(onPageSize).toHaveBeenCalledWith(50);
  });
});
