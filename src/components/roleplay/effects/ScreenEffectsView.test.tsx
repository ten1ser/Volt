import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenEffectsView, screenEffectFlash } from './ScreenEffectsView';

describe('screenEffectFlash', () =>
{
    it('never flashes the first known value', () =>
    {
        expect(screenEffectFlash(null, 100)).toBeNull();
    });

    it('flashes a hit for a drop and a heal for a rise', () =>
    {
        expect(screenEffectFlash(80, 70)).toBe('hit');
        expect(screenEffectFlash(70, 100)).toBe('heal');
    });

    it('ignores an unchanged value', () =>
    {
        expect(screenEffectFlash(80, 80)).toBeNull();
    });
});

describe('ScreenEffectsView', () =>
{
    beforeEach(() => vi.useFakeTimers());
    afterEach(() =>
    {
        cleanup(); vi.useRealTimers();
    });

    it('shows the low-Health pulse and the knocked-out wash', () =>
    {
        const view = render(<ScreenEffectsView health={80} />);

        expect(view.container.querySelector('.rp-screen-fx')).toBeNull();
        view.rerender(<ScreenEffectsView health={20} />);
        expect(view.container.querySelector('.rp-screen-fx--low')).not.toBeNull();
        view.rerender(<ScreenEffectsView health={0} />);
        expect(view.container.querySelector('.rp-screen-fx--knocked-out')).not.toBeNull();
        expect(view.container.querySelector('.rp-screen-fx--low')).toBeNull();
        expect(view.container.querySelector('.rp-screen-fx')).toHaveAttribute('aria-hidden', 'true');
    });

    it('flashes a hit after a drop and a heal after a rise, each for 800 ms', () =>
    {
        const view = render(<ScreenEffectsView health={80} />);

        view.rerender(<ScreenEffectsView health={70} />);
        expect(view.container.querySelector('.rp-screen-fx__flash--hit')).not.toBeNull();
        act(() => vi.advanceTimersByTime(800));
        expect(view.container.querySelector('.rp-screen-fx__flash')).toBeNull();

        view.rerender(<ScreenEffectsView health={100} />);
        expect(view.container.querySelector('.rp-screen-fx__flash--heal')).not.toBeNull();
        act(() => vi.advanceTimersByTime(800));
        expect(view.container.querySelector('.rp-screen-fx')).toBeNull();
    });
});
