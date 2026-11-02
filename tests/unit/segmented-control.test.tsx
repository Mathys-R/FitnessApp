// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Tab = 'a' | 'b';
const OPTIONS = [
  { value: 'a' as Tab, label: 'Alpha' },
  { value: 'b' as Tab, label: 'Bêta' },
];

function Harness({ onChange }: { onChange?: (v: Tab) => void }) {
  const [value, setValue] = useState<Tab>('a');
  return (
    <SegmentedControl
      ariaLabel="Choix"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('SegmentedControl (UI générique)', () => {
  it('expose un role="group" nommé et aria-pressed sur le segment actif', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Choix' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Bêta' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('bascule la sélection et notifie onChange avec la valeur typée', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bêta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('button', { name: 'Bêta' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('garantit des cibles tactiles ≥ 44 px et type="button" (pas de submit implicite)', () => {
    render(<Harness />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
      expect(btn.getAttribute('type')).toBe('button');
    }
  });

  it('supporte des valeurs numériques et le mode largeur au contenu', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Période"
        options={[{ value: 30, label: '30 j' }, { value: 90, label: '90 j' }]}
        value={30}
        onChange={onChange}
        fullWidth={false}
      />
    );
    const group = screen.getByRole('group', { name: 'Période' });
    expect(group.className).toContain('shrink-0');
    expect(screen.getByRole('button', { name: '30 j' }).className).not.toContain('flex-1');
    fireEvent.click(screen.getByRole('button', { name: '90 j' }));
    expect(onChange).toHaveBeenCalledWith(90);
  });
});
