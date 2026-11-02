// @vitest-environment happy-dom
// tests/unit/file-save-utils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCsvBlobContent, saveTextFile } from '@/features/analytics/utils/file-save.utils';

const BOM = '﻿';

describe('buildCsvBlobContent (E5)', () => {
  it('préfixe le BOM UTF-8', () => {
    expect(buildCsvBlobContent('a,b')).toBe(`${BOM}a,b`);
    expect(buildCsvBlobContent('a,b').charCodeAt(0)).toBe(0xfeff);
  });
  it('ne duplique pas le BOM', () => {
    expect(buildCsvBlobContent(`${BOM}a,b`)).toBe(`${BOM}a,b`);
    expect(buildCsvBlobContent(buildCsvBlobContent('x'))).toBe(`${BOM}x`);
  });
  it('chaîne vide → BOM seul', () => {
    expect(buildCsvBlobContent('')).toBe(BOM);
  });
});

describe('saveTextFile', () => {
  const params = { filename: 'daily_logs.csv', content: 'a,b', mimeType: 'text/csv;charset=utf-8' as const };
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'canShare');
  });

  function stubShare(share: (data: ShareData) => Promise<void>, canShare: (d?: ShareData) => boolean) {
    Object.defineProperty(navigator, 'share', { value: vi.fn(share), configurable: true, writable: true });
    Object.defineProperty(navigator, 'canShare', { value: vi.fn(canShare), configurable: true, writable: true });
  }

  it('chemin share : canShare true → navigator.share({files}) → "shared"', async () => {
    stubShare(() => Promise.resolve(), () => true);
    const out = await saveTextFile(params);
    expect(out).toBe('shared');
    const shareArg = (navigator.share as ReturnType<typeof vi.fn>).mock.calls[0][0] as ShareData;
    const file = shareArg.files![0];
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('daily_logs.csv');
    expect(file.type).toContain('text/csv');
    expect(await file.text()).toBe('a,b');
    const canShareArg = (navigator.canShare as ReturnType<typeof vi.fn>).mock.calls[0][0] as ShareData;
    expect(canShareArg.files![0].name).toBe('daily_logs.csv');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('AbortError (DOMException) → "cancelled", sans fallback', async () => {
    stubShare(() => Promise.reject(new DOMException('cancel', 'AbortError')), () => true);
    expect(await saveTextFile(params)).toBe('cancelled');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('AbortError structurel (objet {name}) → "cancelled"', async () => {
    stubShare(() => Promise.reject({ name: 'AbortError' }), () => true);
    expect(await saveTextFile(params)).toBe('cancelled');
  });

  it('autre erreur de share → relancée', async () => {
    const err = new DOMException('denied', 'NotAllowedError');
    stubShare(() => Promise.reject(err), () => true);
    await expect(saveTextFile(params)).rejects.toBe(err);
  });

  it('erreur non-objet (string) → relancée', async () => {
    stubShare(() => Promise.reject('boom'), () => true);
    await expect(saveTextFile(params)).rejects.toBe('boom');
  });

  it('canShare false → fallback anchor', async () => {
    stubShare(() => Promise.resolve(), () => false);
    expect(await saveTextFile(params)).toBe('downloaded');
    expect(navigator.share).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('share présent mais canShare absent → fallback anchor', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true, writable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true, writable: true });
    expect(await saveTextFile(params)).toBe('downloaded');
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it('fallback anchor : href, download = filename, click, retrait du DOM, revoke différé 1 s', async () => {
    vi.useFakeTimers();
    let clicked: HTMLAnchorElement | null = null;
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this;
      expect(document.body.contains(this)).toBe(true);
    });

    const out = await saveTextFile({ filename: 'backup.json', content: '{}', mimeType: 'application/json' });
    expect(out).toBe('downloaded');
    const blob = createObjectURL.mock.calls[0][0] as File;
    expect(blob.name).toBe('backup.json');
    expect(blob.type).toBe('application/json');
    expect(clicked).not.toBeNull();
    expect(clicked!.download).toBe('backup.json');
    expect(clicked!.getAttribute('href')).toBe('blob:mock-url');
    expect(document.body.querySelector('a[download]')).toBeNull();

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
