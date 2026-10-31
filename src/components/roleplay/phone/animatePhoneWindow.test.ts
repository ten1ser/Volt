import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animatePhoneWindow } from './animatePhoneWindow';

describe('phone window opening transition', () =>
{
    let host: HTMLDivElement;
    let stop: (() => void) | undefined;
    beforeEach(() =>
    {
        host = document.getElementById('draggable-windows-container') as HTMLDivElement;
        host.replaceChildren();
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    });
    afterEach(() =>
    {
        stop?.(); stop = undefined;
        host.replaceChildren();
        vi.unstubAllGlobals();
    });
    const addWindow = (key: string) =>
    {
        const wrapper = document.createElement('div');
        wrapper.dataset.windowKey = key;
        wrapper.style.visibility = 'visible';
        wrapper.style.transform = 'translate3d(300px, 100px, 0)';
        const content = document.createElement('section');
        const cancel = vi.fn();
        content.animate = vi.fn(() => ({ cancel }) as unknown as Animation);
        wrapper.append(content); host.append(wrapper);
        return { wrapper, content, cancel };
    };

    it('animates only the requested window content and leaves drag positioning intact', async () =>
    {
        stop = animatePhoneWindow('catalog', { x: 800, y: 500 });
        const other = addWindow('navigator');
        const target = addWindow('catalog');
        await Promise.resolve();
        expect(other.content.animate).not.toHaveBeenCalled();
        expect(target.content.animate).toHaveBeenCalledOnce();
        expect(target.wrapper.style.transform).toBe('translate3d(300px, 100px, 0)');
        target.wrapper.style.left = '200px';
        await Promise.resolve();
        expect(target.content.animate).toHaveBeenCalledOnce();
        stop();
        expect(target.cancel).toHaveBeenCalledOnce();
    });

    it('waits until a newly mounted native window is positioned', async () =>
    {
        stop = animatePhoneWindow('inventory', { x: 0, y: 0 });
        const target = addWindow('inventory');
        target.wrapper.style.visibility = 'hidden';
        await Promise.resolve();
        expect(target.content.animate).not.toHaveBeenCalled();
        target.wrapper.style.visibility = 'visible';
        await Promise.resolve();
        expect(target.content.animate).toHaveBeenCalledOnce();
    });

    it('does not animate a toggle of an existing visible window', async () =>
    {
        const target = addWindow('catalog');
        stop = animatePhoneWindow('catalog', { x: 0, y: 0 });
        target.wrapper.style.visibility = 'hidden';
        await Promise.resolve();
        expect(target.content.animate).not.toHaveBeenCalled();
    });

    it('respects reduced motion and cancels observers when the phone closes', async () =>
    {
        stop = animatePhoneWindow('catalog', { x: 0, y: 0 });
        stop();
        const cancelled = addWindow('catalog');
        await Promise.resolve();
        expect(cancelled.content.animate).not.toHaveBeenCalled();
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
        stop = animatePhoneWindow('inventory', { x: 0, y: 0 });
        const reduced = addWindow('inventory');
        await Promise.resolve();
        expect(reduced.content.animate).not.toHaveBeenCalled();
    });
});
