import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRpHospitalTreatment } from './useRpHospitalTreatment';

const test = vi.hoisted(() => ({ authenticated: true, send: vi.fn(), receive: null as ((event: unknown) => void) | null }));
vi.mock('@volt/renderer', () => ({ RpHospitalTreatmentEvent: class
{}, RpHospitalTreatmentRequestComposer: class
{} }));
vi.mock('../../api/volt/SendMessageComposer', () => ({ SendMessageComposer: test.send }));
vi.mock('../events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (_type: unknown, receive: (event: unknown) => void) =>
{
    test.receive = receive;
} }));

const snapshot = (phase: number, progress: number, remainingMs: number) =>
    act(() => test.receive?.({ getParser: () => ({ phase, progress, remainingMs }) }));

describe('DistrictRP hospital treatment hook', () =>
{
    beforeEach(() =>
    {
        test.authenticated = true;
        test.send.mockClear();
        vi.useFakeTimers();
    });
    afterEach(() =>
    {
        cleanup();
        vi.useRealTimers();
    });

    it('requests own status after authentication and refreshes every two seconds', () =>
    {
        const view = renderHook(() => useRpHospitalTreatment());
        expect(test.send).toHaveBeenCalledTimes(1);
        expect(view.result.current).toBeNull();
        act(() => vi.advanceTimersByTime(2000));
        expect(test.send).toHaveBeenCalledTimes(2);
        view.unmount();
        act(() => vi.advanceTimersByTime(4000));
        expect(test.send).toHaveBeenCalledTimes(2);
    });

    it('exposes only the last server snapshot', () =>
    {
        const view = renderHook(() => useRpHospitalTreatment());
        snapshot(2, 37, 63000);
        expect(view.result.current).toEqual({ phase: 2, progress: 37, remainingMs: 63000 });
        snapshot(0, 0, 0);
        expect(view.result.current).toEqual({ phase: 0, progress: 0, remainingMs: 0 });
    });

    it('clears status on logout and does not resurrect it on reauthentication', () =>
    {
        const view = renderHook(() => useRpHospitalTreatment());
        snapshot(2, 50, 50000);
        act(() =>
        {
            test.authenticated = false;
            view.rerender();
        });
        expect(view.result.current).toBeNull();
        act(() =>
        {
            test.authenticated = true;
            view.rerender();
        });
        expect(view.result.current).toBeNull();
        expect(test.send).toHaveBeenCalledTimes(2);
        snapshot(1, 0, 10000);
        expect(view.result.current).toEqual({ phase: 1, progress: 0, remainingMs: 10000 });
    });

    it('does not request status while disconnected', () =>
    {
        test.authenticated = false;
        const view = renderHook(() => useRpHospitalTreatment());
        expect(test.send).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(6000));
        expect(test.send).not.toHaveBeenCalled();
        expect(view.result.current).toBeNull();
    });
});
