import { CreateLinkEvent } from '@volt/renderer';
import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDistrictWindowKeys } from './useDistrictWindowKeys';

const addWindow = (zIndex: number, rp: boolean) =>
{
    const element = document.createElement('div');
    const close = document.createElement('button');

    element.className = 'draggable-window';
    element.style.zIndex = String(zIndex);
    close.className = rp ? 'district-rp-close' : 'volt-card-close-button';
    close.onclick = vi.fn();
    element.append(close);
    document.getElementById('draggable-windows-container').append(element);
    return close;
};

describe('useDistrictWindowKeys', () =>
{
    beforeEach(() =>
    {
        vi.mocked(CreateLinkEvent).mockClear();
        const container = document.createElement('div');

        container.id = 'draggable-windows-container';
        document.body.append(container);
    });
    afterEach(() =>
    {
        cleanup();
        document.getElementById('draggable-windows-container')?.remove();
    });

    it('closes only the RP window in front on Escape', () =>
    {
        renderHook(() => useDistrictWindowKeys());
        const back = addWindow(401, true);
        const front = addWindow(402, true);

        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(front.onclick).toHaveBeenCalledOnce();
        expect(back.onclick).not.toHaveBeenCalled();
    });

    it('leaves a hotel window in front to its own Escape handling', () =>
    {
        renderHook(() => useDistrictWindowKeys());
        const rp = addWindow(401, true);
        const hotel = addWindow(402, false);

        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(rp.onclick).not.toHaveBeenCalled();
        expect(hotel.onclick).not.toHaveBeenCalled();
    });

    it('toggles the backpack, radio and phone with Alt and ignores other modifiers', () =>
    {
        renderHook(() => useDistrictWindowKeys());
        fireEvent.keyDown(document.body, { code: 'KeyB', key: 'b', altKey: true });
        fireEvent.keyDown(document.body, { code: 'KeyR', key: 'r', altKey: true });
        fireEvent.keyDown(document.body, { code: 'KeyP', key: 'p', altKey: true });
        expect(vi.mocked(CreateLinkEvent).mock.calls.map(call => call[0])).toEqual(['backpack/toggle', 'radio/toggle', 'phone/toggle']);

        vi.mocked(CreateLinkEvent).mockClear();
        fireEvent.keyDown(document.body, { code: 'KeyB', key: 'b' });
        fireEvent.keyDown(document.body, { code: 'KeyB', key: 'b', altKey: true, ctrlKey: true });
        fireEvent.keyDown(document.body, { code: 'KeyB', key: 'b', altKey: true, repeat: true });
        expect(CreateLinkEvent).not.toHaveBeenCalled();
    });
});
