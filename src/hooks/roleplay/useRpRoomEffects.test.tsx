import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROOM_EFFECT_MAX, roomEffectLifetimeMs, useRpRoomEffects } from './useRpRoomEffects';

const test = vi.hoisted(() => ({ receive: null }));

vi.mock('@volt/renderer', () => ({ RpRoomEffectEvent: class
{} }));
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (_type: unknown, receive: (event: unknown) => void) =>
{
    test.receive = receive;
} }));

const push = (kind: number, amount = 0) => act(() => test.receive?.({ getParser: () => ({ kind, targetVirtualId: 7, sourceVirtualId: 3, amount }) }));

describe('useRpRoomEffects', () =>
{
    beforeEach(() =>
    {
        test.receive = null;
        vi.useFakeTimers();
    });
    afterEach(() =>
    {
        cleanup(); vi.useRealTimers();
    });

    it('adds an entry for a room effect and removes it after its lifetime', () =>
    {
        const view = renderHook(() => useRpRoomEffects());
        push(0, 9);
        expect(view.result.current).toEqual([{ id: 1, kind: 0, targetVirtualId: 7, sourceVirtualId: 3, amount: 9 }]);
        act(() => vi.advanceTimersByTime(1199));
        expect(view.result.current).toHaveLength(1);
        act(() => vi.advanceTimersByTime(1));
        expect(view.result.current).toEqual([]);
    });

    it('keeps the knockout effect up for its longer animation', () =>
    {
        const view = renderHook(() => useRpRoomEffects());
        push(5);
        act(() => vi.advanceTimersByTime(1200));
        expect(view.result.current).toHaveLength(1);
        act(() => vi.advanceTimersByTime(1400));
        expect(view.result.current).toEqual([]);
    });

    it('caps the list at ROOM_EFFECT_MAX and drops the oldest entries', () =>
    {
        const view = renderHook(() => useRpRoomEffects());
        act(() =>
        {
            for(let index = 0; index < ROOM_EFFECT_MAX + 1; index++) push(1);
        });
        expect(view.result.current).toHaveLength(ROOM_EFFECT_MAX);
        expect(view.result.current[0].id).toBe(2);
        expect(view.result.current.at(-1).id).toBe(ROOM_EFFECT_MAX + 1);
    });

    it('only stretches the knockout lifetime', () =>
    {
        expect(roomEffectLifetimeMs(5)).toBe(2600);
        expect(roomEffectLifetimeMs(0)).toBe(1200);
        expect(roomEffectLifetimeMs(7)).toBe(1200);
    });
});
