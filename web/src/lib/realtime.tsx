import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from './auth';
import type { Message, Notification, SupportEvent } from './types';
import { OPEN_SUPPORT_EVENT } from '@/components/support/SupportWidget';

/** Satu koneksi SSE per sesi: menyegarkan data dan menampilkan toast notifikasi. */
export function useRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const es = new EventSource('/api/stream');

    es.addEventListener('notification', (e) => {
      const n = JSON.parse((e as MessageEvent).data) as Notification;
      qc.invalidateQueries({ queryKey: ['notifications'] });
      // Pesan chat tidak perlu toast bila sedang membuka ruang chat tiket tsb.
      if (n.type === 'chat.message' && n.link && window.location.pathname === n.link) return;
      const show = n.priority ? toast.warning : toast;
      show(n.title, {
        description: n.body ?? undefined,
        action: n.link ? { label: 'Lihat', onClick: () => navigate(n.link!) } : undefined,
      });
    });
    es.addEventListener('ticket', (e) => {
      const { id } = JSON.parse((e as MessageEvent).data) as { id: number };
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['booking'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
    });
    es.addEventListener('message', (e) => {
      const m = JSON.parse((e as MessageEvent).data) as Message;
      qc.setQueryData<{ messages: Message[] }>(['messages', m.ticketId], (old) =>
        old && !old.messages.some((x) => x.id === m.id) ? { ...old, messages: [...old.messages, m] } : old,
      );
      qc.invalidateQueries({ queryKey: ['tickets'] });
    });
    es.addEventListener('read', (e) => {
      const { ticketId } = JSON.parse((e as MessageEvent).data) as { ticketId: number };
      qc.invalidateQueries({ queryKey: ['messages', ticketId] });
    });
    es.addEventListener('availability', () => {
      qc.invalidateQueries({ queryKey: ['availability'] });
      qc.invalidateQueries({ queryKey: ['booking'] });
    });
    es.addEventListener('account', () => {
      qc.invalidateQueries({ queryKey: ['me'] });
    });
    es.addEventListener('support', (e) => {
      const ev = JSON.parse((e as MessageEvent).data) as SupportEvent;
      qc.invalidateQueries({ queryKey: ['support'] });
      const toAdmin = !ev.message.fromAdmin;
      const isAdmin = user.role === 'admin';
      if (toAdmin !== isAdmin) return; // pesan sendiri
      if (isAdmin) {
        if (window.location.pathname === '/admin/bantuan') return;
        toast(`Chat bantuan dari ${ev.name ?? 'pengguna'}`, {
          description: ev.message.body.length > 90 ? ev.message.body.slice(0, 90) + '…' : ev.message.body,
          action: { label: 'Balas', onClick: () => navigate(`/admin/bantuan?c=${ev.threadId}`) },
        });
      } else {
        toast('Balasan dari admin', {
          description: ev.message.body.length > 90 ? ev.message.body.slice(0, 90) + '…' : ev.message.body,
          action: { label: 'Buka', onClick: () => window.dispatchEvent(new Event(OPEN_SUPPORT_EVENT)) },
        });
      }
    });
    es.addEventListener('support-read', () => {
      qc.invalidateQueries({ queryKey: ['support'] });
    });
    return () => es.close();
  }, [user?.id, qc, navigate]);
}
