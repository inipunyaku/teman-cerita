import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revealInvalid } from '@/lib/validation';

const visible = (el: Element) => {
  el.getClientRects = () => ({ length: 1 }) as DOMRectList;
};

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (cb(0), 0));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('revealInvalid', () => {
  it('menggulir & memfokuskan isian tidak valid pertama yang terlihat', () => {
    document.body.innerHTML = `
      <div id="hidden" data-invalid><input id="a" /></div>
      <div id="wrap" data-invalid><input type="hidden" /><input id="b" disabled /><textarea id="c"></textarea></div>
      <input id="d" data-invalid />`;
    visible(document.getElementById('wrap')!);
    visible(document.getElementById('d')!);
    revealInvalid();
    expect(document.getElementById('wrap')!.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(document.activeElement?.id).toBe('c');
  });

  it('elemen yang sendirinya input langsung difokuskan; root bisa dibatasi', () => {
    document.body.innerHTML = `<input id="out" data-invalid /><form id="f"><select id="s" data-invalid><option>1</option></select></form>`;
    visible(document.getElementById('out')!);
    visible(document.getElementById('s')!);
    revealInvalid(document.getElementById('f')!);
    expect(document.activeElement?.id).toBe('s');
  });

  it('tidak melakukan apa pun bila tidak ada yang invalid/terlihat', () => {
    document.body.innerHTML = `<input id="x" data-invalid />`;
    expect(() => revealInvalid()).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });
});
