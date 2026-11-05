import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRpRadioSource } from './useRpRadio';

const test = vi.hoisted(() => ({
    handlers: new Map<unknown, (event: unknown) => void>(),
    sent: [] as any[],
    authenticated: true,
    userId: 1,
    identityListeners: new Set<() => void>(),
    identity: { userId: 1 },
    setIdentity(userId: number)
    {
        this.userId = userId;
        this.identity = { userId };
        for(const listener of this.identityListeners) listener();
    },
    snapshot()
    {
        if(this.identity.userId !== this.userId) this.identity = { userId: this.userId };
        return this.identity;
    }
}));
vi.mock('@volt/renderer', () =>
{
    class RpRadioStatusEvent {}
    class RpRadioTransmissionEvent {}
    class RpRadioRequestComposer
    {
        constructor(public requestId: number, public action: number, public channel: number, public frequency: number, public text: string)
        {}
    }
    return { RpRadioStatusEvent, RpRadioTransmissionEvent, RpRadioRequestComposer };
});
vi.mock('../session/useSessionSnapshots', async () =>
{
    const { useSyncExternalStore } = await import('react');
    return {
        useUserDataSnapshot: () => useSyncExternalStore(
            (onChange: () => void) =>
            {
                test.identityListeners.add(onChange);
                return () => test.identityListeners.delete(onChange);
            },
            () => test.snapshot()
        )
    };
});
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (type: unknown, handler: (event: unknown) => void) => test.handlers.set(type, handler) }));
vi.mock('../events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../../api/volt/SendMessageComposer', () => ({ SendMessageComposer: (composer: unknown) => test.sent.push(composer) }));
vi.mock('../../state/useSharedHook', () => ({ registerSharedHook: vi.fn(), useSharedHook: (source: () => unknown) => source() }));

const renderer = await import('@volt/renderer');
const deliver = (type: unknown, parser: object) => act(() => test.handlers.get(type)({ getParser: () => parser }));
const status = (requestId: number, overrides: object = {}) => ({ requestId, refused: false, notice: '', powered: true, channel: 0, frequency: 1234,
    channelLabel: 'Public', hospitalAccess: false, gangAccess: true, listeners: 2, ...overrides });
const transmission = (overrides: object = {}) => ({ channel: 0, frequency: 1234, channelLabel: 'Public', senderId: 2, senderName: 'bob',
    senderRank: '', text: 'meet at the bank', sentAt: 1700000000, ...overrides });
describe('useRpRadio', () =>
{
    beforeEach(() =>
    {
        test.handlers.clear(); test.sent = []; test.authenticated = true; test.userId = 1;
        test.identityListeners.clear(); test.identity = { userId: 1 };
    });

    it('reads the status once signed in and shows only correlated notices', () =>
    {
        const { result } = renderHook(() => useRpRadioSource());
        expect(test.sent[0]).toMatchObject({ action: 0, channel: 0, frequency: 0, text: '' });
        deliver(renderer.RpRadioStatusEvent, status(test.sent[0].requestId));
        expect(result.current.status).toMatchObject({ powered: true, channel: 0, frequency: 1234, gangAccess: true, listeners: 2 });
        expect(result.current.notice).toBeNull();

        act(() => result.current.power(false));
        expect(test.sent[1]).toMatchObject({ action: 1, channel: 0, frequency: 0, text: '' });
        deliver(renderer.RpRadioStatusEvent, status(999, { notice: 'Not yours', refused: true }));
        expect(result.current.notice).toBeNull();
        deliver(renderer.RpRadioStatusEvent, status(test.sent[1].requestId, { notice: 'The radio is off.', refused: true, powered: false }));
        expect(result.current.notice).toEqual({ text: 'The radio is off.', refused: true });
        expect(result.current.status?.powered).toBe(false);
    });

    it('starts once the account identity arrives after authentication', () =>
    {
        test.userId = 0;
        const { result } = renderHook(() => useRpRadioSource());
        expect(test.sent).toHaveLength(0);

        act(() => test.setIdentity(1));
        expect(test.sent).toHaveLength(1);
        expect(test.sent[0]).toMatchObject({ action: 0, channel: 0, frequency: 0, text: '' });
        expect(result.current.status).toBeNull();

        deliver(renderer.RpRadioStatusEvent, status(test.sent[0].requestId, { powered: false }));
        expect(result.current.status?.powered).toBe(false);
        expect(result.current.pending).toBe(false);

        act(() => result.current.power(true));
        expect(test.sent).toHaveLength(2);
        expect(test.sent[1]).toMatchObject({ action: 1, channel: 1, frequency: 0 });
        deliver(renderer.RpRadioStatusEvent, status(test.sent[1].requestId, { powered: true }));
        expect(result.current.status?.powered).toBe(true);

        act(() => test.setIdentity(1));
        expect(test.sent).toHaveLength(2);
    });

    it('records real transmissions and keeps the feed bounded', () =>
    {
        const { result } = renderHook(() => useRpRadioSource());
        deliver(renderer.RpRadioStatusEvent, status(test.sent[0].requestId));
        for(let index = 0; index < 105; index++)
        {
            deliver(renderer.RpRadioTransmissionEvent, transmission({ senderId: index + 1, text: `line ${ index }` }));
        }
        expect(result.current.messages).toHaveLength(100);
        expect(result.current.messages.at(-1)?.text).toBe('line 104');
    });
    it('sends power, tune and transmit against the committed channel', () =>
    {
        const { result } = renderHook(() => useRpRadioSource());
        deliver(renderer.RpRadioStatusEvent, status(test.sent[0].requestId));

        act(() => result.current.tune(0, 1300));
        expect(test.sent.at(-1)).toMatchObject({ action: 2, channel: 0, frequency: 1300, text: '' });
        deliver(renderer.RpRadioStatusEvent, status(test.sent.at(-1).requestId, { channel: 0, frequency: 1300 }));
        act(() => result.current.transmit('hello'));
        expect(test.sent.at(-1)).toMatchObject({ action: 3, channel: 0, frequency: 1300, text: 'hello' });
        deliver(renderer.RpRadioStatusEvent, status(test.sent.at(-1).requestId, { channel: 0, frequency: 1300 }));

        act(() => result.current.tune(1, 0));
        expect(test.sent.at(-1)).toMatchObject({ action: 2, channel: 1, frequency: 0 });
        deliver(renderer.RpRadioStatusEvent, status(test.sent.at(-1).requestId, { channel: 1, frequency: 0, channelLabel: 'Hospital' }));
        act(() => result.current.transmit('on my way'));
        expect(test.sent.at(-1)).toMatchObject({ action: 3, channel: 1, frequency: 0, text: 'on my way' });
        deliver(renderer.RpRadioStatusEvent, status(test.sent.at(-1).requestId, { channel: 1, frequency: 0, channelLabel: 'Hospital' }));

        act(() => result.current.power(false));
        expect(test.sent.at(-1)).toMatchObject({ action: 1, channel: 0, frequency: 0 });
    });

    it('resets the radio state on sign-out and on an account change', () =>
    {
        const { result, rerender } = renderHook(() => useRpRadioSource());
        deliver(renderer.RpRadioStatusEvent, status(test.sent[0].requestId));
        deliver(renderer.RpRadioTransmissionEvent, transmission());
        expect(result.current.messages).toHaveLength(1);

        test.authenticated = false;
        rerender();
        expect([result.current.status, result.current.messages]).toEqual([null, []]);

        test.authenticated = true;
        test.userId = 2;
        rerender();
        expect(result.current.status).toBeNull();
        expect(result.current.messages).toEqual([]);
    });

    it('checks correlation before applying a reply and lets a push refresh without consuming the request', () =>
    {
        const { result } = renderHook(() => useRpRadioSource());
        deliver(renderer.RpRadioStatusEvent, status(test.sent[0].requestId));
        act(() => result.current.power(false));
        const pendingId = test.sent.at(-1).requestId;

        deliver(renderer.RpRadioStatusEvent, status(1, { powered: false, channel: 2, frequency: 0, channelLabel: 'Gang' }));
        expect(result.current.status).toMatchObject({ powered: true, channel: 0, frequency: 1234 });
        expect(result.current.pending).toBe(true);

        deliver(renderer.RpRadioStatusEvent, status(0, { channel: 0, frequency: 4321 }));
        expect(result.current.status).toMatchObject({ powered: true, frequency: 4321 });
        expect(result.current.pending).toBe(true);

        deliver(renderer.RpRadioStatusEvent, status(pendingId, { powered: false }));
        expect(result.current.status?.powered).toBe(false);
        expect(result.current.pending).toBe(false);
    });

    it('ignores incoming traffic while signed out or without a valid account', () =>
    {
        test.authenticated = false;
        const { result } = renderHook(() => useRpRadioSource());
        expect(test.sent).toHaveLength(0);
        deliver(renderer.RpRadioStatusEvent, status(0));
        deliver(renderer.RpRadioTransmissionEvent, transmission());
        expect(result.current.status).toBeNull();
        expect(result.current.messages).toEqual([]);
    });

    it('clears its pending timeout when the shared hook unmounts', () =>
    {
        vi.useFakeTimers();
        try
        {
            const { unmount } = renderHook(() => useRpRadioSource());
            expect(vi.getTimerCount()).toBeGreaterThan(0);
            unmount();
            expect(vi.getTimerCount()).toBe(0);
        }
        finally
        {
            vi.useRealTimers();
        }
    });

    it('rejects transmissions the server would refuse instead of truncating them', () =>
    {
        const { result } = renderHook(() => useRpRadioSource());
        deliver(renderer.RpRadioStatusEvent, status(test.sent[0].requestId));
        const sentBefore = test.sent.length;

        expect(result.current.transmit('')).toBe(false);
        expect(result.current.transmit('x'.repeat(121))).toBe(false);
        expect(test.sent).toHaveLength(sentBefore);

        expect(result.current.transmit('x'.repeat(120))).toBe(true);
        expect(test.sent.at(-1).text).toHaveLength(120);
    });
});