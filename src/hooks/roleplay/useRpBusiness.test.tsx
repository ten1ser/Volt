import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessQuery, useRpBusiness } from './useRpBusiness';

const test = vi.hoisted(() => ({ authenticated: true, send: vi.fn(), receive: null }));
vi.mock('@volt/renderer', () => ({ RpBusinessEvent: class
{}, RpBusinessRequestComposer: class
{
    constructor(public id: number, public action: number, public target: number, public level: number, public page: number, public filter: number, public search: string)
    {}
} }));
vi.mock('../../api/volt/SendMessageComposer', () => ({ SendMessageComposer: test.send }));
vi.mock('../events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (_type: unknown, receive: (event: unknown) => void) =>
{
    test.receive = receive;
} }));
const payload = { available: true, self: { onDuty: true, remainingMs: 10000 } };
const reply = (id: number) => act(() => test.receive?.({ getParser: () => ({ requestId: id, snapshot: payload }) }));
const query: BusinessQuery = { page: 0, rankFilter: 0, search: '' };
const latest = () => test.send.mock.calls.at(-1)[0];

describe('Business window requests', () =>
{
    beforeEach(() =>
    {
        test.authenticated = true; test.send.mockClear(); vi.useFakeTimers(); Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    });
    afterEach(() =>
    {
        cleanup(); vi.useRealTimers();
    });
    it('loads only while open and authenticated, polls, and stops on close', () =>
    {
        const view = renderHook(({ open }) => useRpBusiness(open, query), { initialProps: { open: false } });
        act(() => vi.advanceTimersByTime(5000)); expect(test.send).not.toHaveBeenCalled();
        view.rerender({ open: true }); act(() => vi.advanceTimersByTime(300)); expect(test.send).toHaveBeenCalledTimes(1);
        reply(latest().id); act(() => vi.advanceTimersByTime(5000)); expect(test.send).toHaveBeenCalledTimes(2);
        view.rerender({ open: false }); reply(latest().id); expect(view.result.current.snapshot).toBeNull();
        act(() => vi.advanceTimersByTime(10000)); expect(test.send).toHaveBeenCalledTimes(2);
    });
    it('debounces queries and ignores responses from the old query', () =>
    {
        const view = renderHook(({ search }) => useRpBusiness(true, { ...query, search }), { initialProps: { search: '' } });
        act(() => vi.advanceTimersByTime(300)); const old = latest().id;
        view.rerender({ search: 'ten' }); act(() => vi.advanceTimersByTime(150)); view.rerender({ search: 'teniser' });
        reply(old); expect(view.result.current.snapshot).toBeNull();
        act(() => vi.advanceTimersByTime(300)); expect(latest().search).toBe('teniser');
        reply(latest().id); expect(view.result.current.snapshot).toEqual(payload);
    });
    it('does not duplicate a mutation, retry it on timeout or accept its late reply', () =>
    {
        const view = renderHook(() => useRpBusiness(true, query));
        act(() => vi.advanceTimersByTime(300)); reply(latest().id);
        act(() =>
        {
            view.result.current.act(1); view.result.current.act(1);
        });
        const id = latest().id; expect(test.send).toHaveBeenCalledTimes(2);
        act(() => vi.advanceTimersByTime(20000)); expect(test.send).toHaveBeenCalledTimes(2);
        expect(view.result.current.error).toContain('could not be confirmed');
        reply(id); expect(view.result.current.error).not.toBe('');
        act(() => view.result.current.refresh()); expect(latest().action).toBe(0);
    });
    it('drops session data on logout and ignores a prior session reply after reconnect', () =>
    {
        const view = renderHook(() => useRpBusiness(true, query)); act(() => vi.advanceTimersByTime(300)); const old = latest().id;
        test.authenticated = false; view.rerender(); reply(old); expect(view.result.current.snapshot).toBeNull();
        test.authenticated = true; view.rerender(); act(() => vi.advanceTimersByTime(300)); reply(old); expect(view.result.current.snapshot).toBeNull();
    });
    it('pauses network requests in a hidden document', () =>
    {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        renderHook(() => useRpBusiness(true, query)); act(() => vi.advanceTimersByTime(6000)); expect(test.send).not.toHaveBeenCalled();
        Object.defineProperty(document, 'hidden', { configurable: true, value: false }); act(() => document.dispatchEvent(new Event('visibilitychange'))); expect(test.send).toHaveBeenCalledTimes(1);
    });
});
