import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { killDeathRatio, useRpProfile } from './useRpProfile';

const test = vi.hoisted(() => ({ handlers: new Map<unknown, (event: unknown) => void>(), sent: [] as any[], authenticated: true }));
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
    return { UserProfileEvent, RpProfileEvent, RpProfileRequestComposer, RoomEngineObjectEvent: { SELECTED: 'selected' }, RoomObjectCategory: { UNIT: 100 },
        RoomObjectType: { USER: 1 } };
});
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (type: unknown, handler: (event: unknown) => void) => test.handlers.set(type, handler) }));
vi.mock('../events/useVoltEvent', () => ({ useVoltEvent: vi.fn() }));
vi.mock('../events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../../api/volt/SendMessageComposer', () => ({ SendMessageComposer: (composer: unknown) => test.sent.push(composer) }));
vi.mock('../../api/volt/session/GetRoomSession', () => ({ GetRoomSession: vi.fn() }));
vi.mock('../../api/user/GetUserProfile', () => ({ GetUserProfile: vi.fn() }));

const renderer = await import('@volt/renderer');
const profile = (id: number, username: string) => ({ getParser: () => ({ id, username, figure: `figure-${id}` }) });
const reply = (requestId: number, userId: number, kills = 3) => ({ getParser: () => ({ requestId, userId, available: true, gang: '', job: 'Hospital', rank: 'Trainee',
    kills, deaths: 1, punchesThrown: 10, punchesMissed: 2, punchesReceived: 5, timesJailed: 0 }) });
const deliver = (type: unknown, event: unknown) => act(() => test.handlers.get(type)(event));

describe('useRpProfile', () =>
{
    beforeEach(() =>
    {
        test.handlers.clear(); test.sent = []; test.authenticated = true;
    });

    it('opens on the native profile and requests the RP card for that user', () =>
    {
        const { result } = renderHook(() => useRpProfile());
        deliver(renderer.UserProfileEvent, profile(5, 'teniser'));
        expect(result.current.identity).toEqual({ userId: 5, username: 'teniser', figure: 'figure-5' });
        expect(test.sent.at(-1)).toMatchObject({ userId: 5 });

        deliver(renderer.RpProfileEvent, reply(test.sent.at(-1).requestId, 5));
        expect(result.current.card).toMatchObject({ job: 'Hospital', rank: 'Trainee', kills: 3 });
    });

    it('ignores a late reply for an earlier profile', () =>
    {
        const { result } = renderHook(() => useRpProfile());
        deliver(renderer.UserProfileEvent, profile(5, 'teniser'));
        const first = test.sent.at(-1).requestId;
        deliver(renderer.UserProfileEvent, profile(6, 'marco'));
        deliver(renderer.RpProfileEvent, reply(first, 5));
        expect(result.current.card).toBeNull();
        deliver(renderer.RpProfileEvent, reply(test.sent.at(-1).requestId, 6, 9));
        expect(result.current.card?.kills).toBe(9);
    });

    it('closes and hides everything when signed out', () =>
    {
        const { result, rerender } = renderHook(() => useRpProfile());
        deliver(renderer.UserProfileEvent, profile(5, 'teniser'));
        act(() => result.current.close());
        expect(result.current.identity).toBeNull();
        deliver(renderer.UserProfileEvent, profile(5, 'teniser'));
        test.authenticated = false;
        rerender();
        expect(result.current.identity).toBeNull();
    });

    it('works out K/D with two decimals and treats no deaths as the kill count', () =>
    {
        expect(killDeathRatio(12, 4)).toBe('3.00');
        expect(killDeathRatio(7, 3)).toBe('2.33');
        expect(killDeathRatio(5, 0)).toBe('5.00');
        expect(killDeathRatio(0, 0)).toBe('0.00');
    });
});
