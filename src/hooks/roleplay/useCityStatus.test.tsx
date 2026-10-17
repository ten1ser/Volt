import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCityStatusSource } from './useCityStatus';

const test = vi.hoisted(() => ({ authenticated: true, now: 0, send: vi.fn(), receive: null }));
vi.mock('@volt/renderer', () => ({ RpCityEvent: class
{}, RpCityRequestComposer: class
{} }));
vi.mock('../../api/volt/SendMessageComposer', () => ({ SendMessageComposer: test.send }));
vi.mock('../events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (_type: unknown, receive: (event: unknown) => void) =>
{
    test.receive = receive;
} }));
vi.mock('../../state/useSharedHook', () => ({ registerSharedHook: () =>
{}, useSharedHook: () => ({}) }));
const receive = (cycleElapsedMs: number, onlinePlayers = 32) => act(() => test.receive({ getParser: () =>
    ({ cycleElapsedMs, cycleDurationMs: 1800000, dayDurationMs: 900000, onlinePlayers }) }));
beforeEach(() =>
{
    test.authenticated = true; test.now = 0; test.send.mockClear(); vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockImplementation(() => test.now);
});
afterEach(() =>
{
    cleanup(); vi.restoreAllMocks(); vi.useRealTimers();
});
describe('server city synchronization', () =>
{
    it('waits for the server, advances monotonically and clears on disconnect/reconnect', () =>
    {
        const { result, rerender } = renderHook(useCityStatusSource);
        expect(result.current.city).toBeNull();
        expect(test.send).toHaveBeenCalledTimes(1);
        receive(0);
        expect(result.current.city?.time).toBe('06:00');
        test.now = 450000;
        act(() => vi.advanceTimersByTime(250));
        expect(result.current.city?.time).toBe('12:00');
        test.authenticated = false; rerender();
        expect(result.current.city).toBeNull();
        const calls = test.send.mock.calls.length;
        act(() => vi.advanceTimersByTime(30000));
        expect(test.send).toHaveBeenCalledTimes(calls);
        test.authenticated = true; rerender();
        expect(result.current.city).toBeNull();
        receive(900000, 7);
        expect(result.current.city).toMatchObject({ time: '18:00', isDay: false, onlinePlayers: 7 });
    });
    it('refreshes population periodically and stops both timers after unmount', () =>
    {
        const view = renderHook(useCityStatusSource);
        receive(0);
        act(() => vi.advanceTimersByTime(15000));
        expect(test.send).toHaveBeenCalledTimes(2);
        receive(15000, 4);
        expect(view.result.current.city?.onlinePlayers).toBe(4);
        view.unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});
