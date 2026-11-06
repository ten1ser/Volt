import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerCardAffiliations } from './usePlayerCardAffiliations';

const test = vi.hoisted(() => ({
    handlers: new Map<unknown, (event: unknown) => void>(),
    sent: [] as any[],
    authenticated: true,
    failSend: false
}));

vi.mock('@volt/renderer', () =>
{
    class UserProfileEvent
    {}
    class RpProfileEvent
    {}
    class RpProfileRequestComposer
    {
        constructor(public requestId: number, public userId: number)
        {}
    }

    return {
        UserProfileEvent,
        RpProfileEvent,
        RpProfileRequestComposer,
        RoomEngineObjectEvent: { SELECTED: 'selected' },
        RoomObjectCategory: { UNIT: 100 },
        RoomObjectType: { USER: 1 }
    };
});
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (type: unknown, handler: (event: unknown) => void) => test.handlers.set(type, handler) }));
vi.mock('../events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../events/useVoltEvent', () => ({ useVoltEvent: vi.fn() }));
vi.mock('../../api/volt/SendMessageComposer', () => ({
    SendMessageComposer: (composer: unknown) =>
    {
        if(test.failSend) throw new Error('offline');
        test.sent.push(composer);
    }
}));
vi.mock('../../api/volt/session/GetRoomSession', () => ({ GetRoomSession: vi.fn() }));
vi.mock('../../api/user/GetUserProfile', () => ({ GetUserProfile: vi.fn() }));

const renderer = await import('@volt/renderer');

const reply = (requestId: number, userId: number, fields: Partial<{
    job: string;
    jobBadge: string;
    gang: string;
    gangBadge: string;
    gangRank: string;
    onDuty: boolean;
    rank: string;
    kills: number;
    deaths: number;
    punchesThrown: number;
    punchesMissed: number;
    punchesReceived: number;
    timesJailed: number;
    available: boolean;
}> = {}) => ({
    getParser: () => ({
        requestId,
        userId,
        available: true,
        gang: '',
        job: '',
        rank: '',
        kills: 0,
        deaths: 0,
        punchesThrown: 0,
        punchesMissed: 0,
        punchesReceived: 0,
        timesJailed: 0,
        jobBadge: '',
        gangBadge: '',
        gangRank: '',
        onDuty: false,
        ...fields
    })
});

const deliver = (type: unknown, event: unknown) => act(() => test.handlers.get(type)(event));

describe('usePlayerCardAffiliations', () =>
{
    beforeEach(() =>
    {
        test.handlers.clear();
        test.sent = [];
        test.authenticated = true;
        test.failSend = false;
        vi.useRealTimers();
    });

    afterEach(() =>
    {
        vi.useRealTimers();
    });

    it('requests the mounted user and exposes the authoritative job and gang metadata', () =>
    {
        const { result } = renderHook(() => usePlayerCardAffiliations(5));
        expect(test.sent[0]).toMatchObject({ userId: 5 });
        expect(result.current.loading).toBe(true);

        deliver(renderer.RpProfileEvent, reply(test.sent[0].requestId, 5, {
            job: 'Hospital',
            jobBadge: 'b-job',
            gang: 'Kings',
            gangBadge: 'b-gang',
            gangRank: 'Enforcer',
            onDuty: true,
            rank: 'Captain',
            kills: 12,
            deaths: 4,
            punchesThrown: 20,
            punchesMissed: 5,
            punchesReceived: 9,
            timesJailed: 2
        }));

        expect(result.current).toMatchObject({
            loading: false,
            unavailable: false,
            job: 'Hospital',
            jobBadge: 'b-job',
            gang: 'Kings',
            gangBadge: 'b-gang',
            gangRank: 'Enforcer',
            onDuty: true,
            rank: 'Captain',
            kills: 12,
            deaths: 4,
            punchesThrown: 20,
            punchesMissed: 5,
            punchesReceived: 9,
            timesJailed: 2
        });
    });

    it('represents an unavailable profile explicitly', () =>
    {
        const { result } = renderHook(() => usePlayerCardAffiliations(9));
        deliver(renderer.RpProfileEvent, reply(test.sent[0].requestId, 9, { available: false }));

        expect(result.current.loading).toBe(false);
        expect(result.current.unavailable).toBe(true);
        expect(result.current.jobBadge).toBe('');
    });

    it('ignores out-of-order replies and clears immediately when the user changes', () =>
    {
        const { result, rerender } = renderHook(({ id }) => usePlayerCardAffiliations(id), { initialProps: { id: 5 } });
        const first = test.sent.at(-1).requestId;

        deliver(renderer.RpProfileEvent, reply(first, 5, { job: 'Hospital', jobBadge: 'b-job', rank: 'Captain', kills: 12, deaths: 4 }));
        expect(result.current.job).toBe('Hospital');
        expect(result.current.kills).toBe(12);
        expect(result.current.deaths).toBe(4);

        rerender({ id: 6 });
        expect(result.current).toMatchObject({
            loading: true,
            job: '',
            jobBadge: '',
            gang: '',
            gangBadge: '',
            rank: '',
            kills: 0,
            deaths: 0,
            punchesThrown: 0,
            punchesMissed: 0,
            punchesReceived: 0,
            timesJailed: 0
        });

        deliver(renderer.RpProfileEvent, reply(first, 5, { job: 'Hospital', jobBadge: 'b-job', rank: 'Captain', kills: 12, deaths: 4 }));
        expect(result.current.job).toBe('');
        expect(result.current.jobBadge).toBe('');
        expect(result.current.kills).toBe(0);

        const second = test.sent.at(-1).requestId;
        deliver(renderer.RpProfileEvent, reply(second, 6, {
            gang: 'Wolves',
            gangBadge: 'b-wolf',
            rank: 'Sergeant',
            kills: 3,
            deaths: 8,
            punchesThrown: 4,
            punchesMissed: 1,
            punchesReceived: 6,
            timesJailed: 1
        }));
        expect(result.current.gang).toBe('Wolves');
        expect(result.current.gangBadge).toBe('b-wolf');
        expect(result.current).toMatchObject({
            rank: 'Sergeant',
            kills: 3,
            deaths: 8,
            punchesThrown: 4,
            punchesMissed: 1,
            punchesReceived: 6,
            timesJailed: 1
        });
    });

    it('clears and ignores replies after logout', () =>
    {
        const { result, rerender } = renderHook(() => usePlayerCardAffiliations(5));
        const requestId = test.sent.at(-1).requestId;

        deliver(renderer.RpProfileEvent, reply(requestId, 5, { job: 'Hospital', jobBadge: 'b-job', rank: 'Captain', kills: 12, deaths: 4 }));
        expect(result.current.job).toBe('Hospital');
        expect(result.current.kills).toBe(12);

        test.authenticated = false;
        rerender();

        expect(result.current).toMatchObject({
            loading: false,
            unavailable: false,
            job: '',
            jobBadge: '',
            gang: '',
            gangBadge: '',
            rank: '',
            kills: 0,
            deaths: 0,
            punchesThrown: 0,
            punchesMissed: 0,
            punchesReceived: 0,
            timesJailed: 0
        });

        deliver(renderer.RpProfileEvent, reply(requestId, 5, { job: 'Hospital', jobBadge: 'b-job', rank: 'Captain', kills: 12, deaths: 4 }));
        expect(result.current.job).toBe('');
        expect(result.current.jobBadge).toBe('');
        expect(result.current.kills).toBe(0);
    });

    it('becomes unavailable after the bounded timeout or a send failure', () =>
    {
        vi.useFakeTimers();
        const { result } = renderHook(() => usePlayerCardAffiliations(5));

        act(() => vi.advanceTimersByTime(5000));

        expect(result.current).toMatchObject({
            loading: false,
            unavailable: true,
            job: '',
            jobBadge: '',
            rank: '',
            kills: 0,
            deaths: 0,
            punchesThrown: 0,
            punchesMissed: 0,
            punchesReceived: 0,
            timesJailed: 0
        });

        test.failSend = true;
        const failed = renderHook(() => usePlayerCardAffiliations(7));

        expect(failed.result.current).toMatchObject({ loading: false, unavailable: true });
    });

    it('sends nothing for an invalid user id', () =>
    {
        const { result } = renderHook(() => usePlayerCardAffiliations(0));

        expect(test.sent).toHaveLength(0);
        expect(result.current).toMatchObject({
            loading: false,
            unavailable: false,
            job: '',
            jobBadge: '',
            gang: '',
            gangBadge: '',
            rank: '',
            kills: 0,
            deaths: 0,
            punchesThrown: 0,
            punchesMissed: 0,
            punchesReceived: 0,
            timesJailed: 0
        });
    });
});
