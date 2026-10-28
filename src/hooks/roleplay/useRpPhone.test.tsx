import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRpPhoneSource } from './useRpPhone';

const test = vi.hoisted(() => ({ handlers: new Map<unknown, (event: unknown) => void>(), sent: [] as any[], authenticated: true }));
vi.mock('@volt/renderer', () =>
{
    class RpPhoneStatusEvent
    {}
    class RpPhoneCallEvent
    {}
    class RpPhoneCallLineEvent
    {}
    class RpPhoneOfferEvent
    {}
    class RpPhoneHistoryEvent
    {}
    class RpPhoneLocationEvent
    {}
    class RpPhoneRequestComposer
    {
        constructor(public requestId: number, public action: number, public value: string)
        {}
    }
    class RpPhoneCallActionComposer
    {
        constructor(public action: number, public number: string)
        {}
    }
    class RpPhoneOfferResponseComposer
    {
        constructor(public offerId: string, public accepted: number)
        {}
    }
    return { RpPhoneStatusEvent, RpPhoneCallEvent, RpPhoneCallLineEvent, RpPhoneOfferEvent, RpPhoneHistoryEvent, RpPhoneLocationEvent, RpPhoneRequestComposer, RpPhoneCallActionComposer, RpPhoneOfferResponseComposer };
});
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (type: unknown, handler: (event: unknown) => void) => test.handlers.set(type, handler) }));
vi.mock('../events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../../api/volt/SendMessageComposer', () => ({ SendMessageComposer: (composer: unknown) => test.sent.push(composer) }));
vi.mock('../../state/useSharedHook', () => ({ registerSharedHook: vi.fn(), useSharedHook: (source: () => unknown) => source() }));

const renderer = await import('@volt/renderer');
const CALL = 'a'.repeat(32);
const deliver = (type: unknown, parser: object) => act(() => test.handlers.get(type)({ getParser: () => parser }));
const status = (requestId: number, message = '', refused = false) => ({ requestId, refused, message, hasSim: true, number: '+12-345-6', load: 7,
    hospitalNumber: '112', policeNumber: '911', messageCost: 1, callCost: 1, callPeriodSeconds: 30 });

describe('useRpPhone', () =>
{
    beforeEach(() =>
    {
        test.handlers.clear(); test.sent = []; test.authenticated = true;
    });

    it('reads the status once signed in and shows only replies to the player\'s own actions', () =>
    {
        const { result } = renderHook(() => useRpPhoneSource());
        expect(test.sent[0]).toMatchObject({ action: 0, value: '' });
        deliver(renderer.RpPhoneStatusEvent, status(test.sent[0].requestId, 'ignored'));
        expect(result.current.status).toMatchObject({ hasSim: true, number: '+12-345-6', load: 7 });
        expect(result.current.notice).toBeNull();

        act(() => result.current.addContact('+22-333-4'));
        deliver(renderer.RpPhoneStatusEvent, status(test.sent[1].requestId, 'No one has that number.', true));
        expect(result.current.notice).toEqual({ text: 'No one has that number.', refused: true });

        deliver(renderer.RpPhoneStatusEvent, status(0, 'You bought a SIM card.'));
        expect(result.current.notice?.text).toBe('You bought a SIM card.');
    });

    it('follows a call through ringing, connected lines and its end', () =>
    {
        const { result } = renderHook(() => useRpPhoneSource());
        act(() => result.current.dial('+22-333-4'));
        expect(test.sent.at(-1)).toMatchObject({ action: 0, number: '+22-333-4' });

        deliver(renderer.RpPhoneCallEvent, { state: 1, callId: CALL, peerName: 'bob', peerNumber: '+22-333-4', seconds: 0, notice: '' });
        expect(result.current.call).toMatchObject({ state: 1, peerName: 'bob' });
        deliver(renderer.RpPhoneCallEvent, { state: 3, callId: CALL, peerName: 'bob', peerNumber: '+22-333-4', seconds: 0, notice: '' });
        deliver(renderer.RpPhoneCallLineEvent, { callId: CALL, fromSelf: false, speaker: 'bob', text: 'hi' });
        deliver(renderer.RpPhoneCallLineEvent, { callId: 'b'.repeat(32), fromSelf: false, speaker: 'eve', text: 'wrong call' });
        expect(result.current.lines).toEqual([{ fromSelf: false, speaker: 'bob', text: 'hi' }]);

        act(() => result.current.hangUp());
        expect(test.sent.at(-1)).toMatchObject({ action: 2 });
        deliver(renderer.RpPhoneCallEvent, { state: 0, callId: CALL, peerName: '', peerNumber: '', seconds: 0, notice: 'Call ended.' });
        expect(result.current.call).toBeNull();
        expect(result.current.lines).toEqual([]);
        expect(result.current.callNotice).toBe('Call ended.');
    });

    it('answers a sale offer once and drops a closed one', () =>
    {
        const { result } = renderHook(() => useRpPhoneSource());
        const offer = { state: 1, offerId: CALL, item: 'sim', amount: 20, price: 50, seller: 'staff', expiresInMs: 60000 };
        deliver(renderer.RpPhoneOfferEvent, offer);
        expect(result.current.offer).toMatchObject({ item: 'sim', price: 50 });

        act(() => result.current.respondOffer(true));
        act(() => result.current.respondOffer(true));
        expect(test.sent.filter(composer => 'accepted' in composer)).toEqual([expect.objectContaining({ offerId: CALL, accepted: 1 })]);
        expect(result.current.offer).toBeNull();

        deliver(renderer.RpPhoneOfferEvent, offer);
        deliver(renderer.RpPhoneOfferEvent, { ...offer, state: 0, offerId: 'c'.repeat(32) });
        expect(result.current.offer).not.toBeNull();
        deliver(renderer.RpPhoneOfferEvent, { ...offer, state: 0 });
        expect(result.current.offer).toBeNull();
    });

    it('asks for recent calls and contact locations and keeps the replies', () =>
    {
        const { result } = renderHook(() => useRpPhoneSource());
        act(() => result.current.loadHistory());
        expect(test.sent.at(-1)).toMatchObject({ action: 3, value: '' });
        const calls = [{ outgoing: true, answered: true, peerName: 'bob', peerNumber: '+22-333-4', agoSeconds: 90, durationSeconds: 42 }];
        deliver(renderer.RpPhoneHistoryEvent, { requestId: test.sent.at(-1).requestId, calls });
        expect(result.current.history).toEqual(calls);

        act(() => result.current.locate(2));
        expect(test.sent.at(-1)).toMatchObject({ action: 4, value: '2' });
        deliver(renderer.RpPhoneLocationEvent, { requestId: test.sent.at(-1).requestId, userId: 2, state: 1, roomName: 'Main Street', message: '' });
        expect(result.current.locations[2]).toEqual({ state: 1, roomName: 'Main Street', message: '' });

        act(() => result.current.setSharing(true));
        expect(test.sent.at(-1)).toMatchObject({ action: 5, value: '1' });
        act(() => result.current.callContact(2));
        expect(test.sent.at(-1)).toMatchObject({ action: 3, number: '2' });
    });

    it('hides everything when signed out', () =>
    {
        const { result, rerender } = renderHook(() => useRpPhoneSource());
        deliver(renderer.RpPhoneStatusEvent, status(test.sent[0].requestId));
        test.authenticated = false;
        rerender();
        expect([result.current.status, result.current.call, result.current.offer]).toEqual([null, null, null]);
    });
});
