import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTargetStats } from './useTargetStats';

type User = { roomIndex: number; webID: number; name: string; figure: string; sex: string; type: number };
type Sent = { requestId: number; roomId: number; targetUserId: number };
type Selection = { id: number; category: number; roomId: number };

const test = vi.hoisted(() => ({
    authenticated: true,
    roomId: 7,
    ownUserId: 1,
    users: [] as User[],
    sent: [] as Sent[],
    receive: null,
    handlers: new Map<string, (event: unknown) => void>()
}));

vi.mock('@volt/renderer', () => ({
    RoomObjectCategory: { UNIT: 20, FLOOR: 30, WALL: 40 },
    RoomObjectType: { USER: 1, PET: 2, BOT: 3 },
    RpTargetStatsEvent: class
    {},
    RpTargetStatsRequestComposer: class
    {
        readonly requestId: number;
        readonly roomId: number;
        readonly targetUserId: number;

        constructor(requestId: number, roomId: number, targetUserId: number)
        {
            this.requestId = requestId;
            this.roomId = roomId;
            this.targetUserId = targetUserId;
        }
    }
}));
vi.mock('../../api/room/events/RoomWidgetUpdateRoomObjectEvent', () => ({
    RoomWidgetUpdateRoomObjectEvent: {
        OBJECT_SELECTED: 'RWUROE_OBJECT_SELECTED',
        OBJECT_DESELECTED: 'RWUROE_OBJECT_DESELECTED',
        USER_REMOVED: 'RWUROE_USER_REMOVED'
    }
}));
vi.mock('../../api/volt/SendMessageComposer', () => ({ SendMessageComposer: (composer: Sent) => test.sent.push(composer) }));
vi.mock('../events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (_type: unknown, receive: (event: unknown) => void) =>
{
    test.receive = receive;
} }));
vi.mock('../events/useUiEvent', () => ({ useUiEvent: (type: string, handler: (event: unknown) => void) =>
{
    test.handlers.set(type, handler);
} }));
vi.mock('../rooms/useRoom', () => ({ useRoom: () => ({ roomSession: { roomId: test.roomId } }) }));
vi.mock('../session/useSessionSnapshots', () => ({
    useUserDataSnapshot: () => ({ userId: test.ownUserId }),
    useRoomUserListSnapshot: () => test.users
}));

const UNIT = 20;
const FLOOR = 30;
const SELECTED = 'RWUROE_OBJECT_SELECTED';
const DESELECTED = 'RWUROE_OBJECT_DESELECTED';
const USER_REMOVED = 'RWUROE_USER_REMOVED';

const human = (roomIndex: number, webID: number, name = `User${webID}`): User => ({ roomIndex, webID, name, figure: 'hr-1', sex: 'F', type: 1 });

const fire = (type: string, event: Selection) => act(() => test.handlers.get(type)?.(event));
const select = (id: number, category = UNIT) => fire(SELECTED, { id, category, roomId: test.roomId });

const reply = (request: Sent, overrides: Partial<{ requestId: number; roomId: number; targetUserId: number; available: boolean; health: number; energy: number }> = {}) =>
    act(() => test.receive?.({
        getParser: () => ({
            requestId: request.requestId,
            roomId: request.roomId,
            targetUserId: request.targetUserId,
            available: true,
            health: 60,
            energy: 40,
            ...overrides
        })
    }));

const last = () => test.sent[test.sent.length - 1];

describe('useTargetStats', () =>
{
    beforeEach(() =>
    {
        test.authenticated = true;
        test.roomId = 7;
        test.users = [
            human(1, 1, 'Me'),
            { roomIndex: 2, webID: 0, name: 'Rex', figure: 'pet', sex: 'M', type: 2 },
            { roomIndex: 3, webID: 0, name: 'Bot', figure: 'bot', sex: 'M', type: 3 },
            human(4, 22, 'Mara')
        ];
        test.sent = [];
        test.handlers.clear();
        vi.useFakeTimers();
    });

    afterEach(() =>
    {
        cleanup();
        vi.useRealTimers();
    });

    it('selects another human in the same room and requests their stats with a correlated id', () =>
    {
        const { result } = renderHook(() => useTargetStats());
        select(4);

        expect(result.current.target).toEqual({ userId: 22, name: 'Mara', figure: 'hr-1', sex: 'F' });
        expect(result.current.stats).toBeNull();
        expect(test.sent).toEqual([{ requestId: 1, roomId: 7, targetUserId: 22 }]);
    });

    it('never requests stats for self, pets, bots or furniture', () =>
    {
        const { result } = renderHook(() => useTargetStats());
        select(1);
        select(2);
        select(3);
        select(4, FLOOR);

        expect(result.current.target).toBeNull();
        expect(test.sent).toEqual([]);
    });

    it('polls every second with unique increasing request ids and stops on unmount', () =>
    {
        const { unmount } = renderHook(() => useTargetStats());
        select(4);
        expect(test.sent).toHaveLength(1);

        act(() => vi.advanceTimersByTime(1000));
        expect(test.sent).toHaveLength(2);
        expect(test.sent[1].requestId).toBeGreaterThan(test.sent[0].requestId);

        unmount();
        act(() => vi.advanceTimersByTime(5000));
        expect(test.sent).toHaveLength(2);
    });

    it('shows stats only for a reply that matches the pending request', () =>
    {
        const { result } = renderHook(() => useTargetStats());
        select(4);
        const request = last();

        reply(request, { roomId: 99 });
        expect(result.current.stats).toBeNull();

        reply(request);
        expect(result.current.stats).toEqual({ health: 60, energy: 40 });
    });

    it('ignores a reply addressed to a different target', () =>
    {
        const { result } = renderHook(() => useTargetStats());
        select(4);
        const request = last();

        reply(request, { targetUserId: 99, health: 1, energy: 2 });
        expect(result.current.stats).toBeNull();
    });

    it('ignores a late reply to an older poll of the same target', () =>
    {
        const { result } = renderHook(() => useTargetStats());
        select(4);
        const first = last();

        act(() => vi.advanceTimersByTime(1000));
        const second = last();
        expect(second.requestId).toBeGreaterThan(first.requestId);

        reply(first, { health: 5, energy: 5 });
        expect(result.current.stats).toBeNull();

        reply(second, { health: 12, energy: 34 });
        expect(result.current.stats).toEqual({ health: 12, energy: 34 });
    });

    it('ignores a late reply after switching targets', () =>
    {
        test.users.push(human(5, 23, 'Jo'));
        const { result } = renderHook(() => useTargetStats());
        select(4);
        const first = last();

        select(5);
        const second = last();
        reply(first);
        expect(result.current.target?.userId).toBe(23);
        expect(result.current.stats).toBeNull();

        reply(second, { health: 12, energy: 34 });
        expect(result.current.stats).toEqual({ health: 12, energy: 34 });
    });

    it('does not resurrect old stats or the old target after a clear', () =>
    {
        const { result } = renderHook(() => useTargetStats());
        select(4);
        const request = last();
        reply(request);

        act(() => result.current.clearTarget());
        expect(result.current.target).toBeNull();
        expect(result.current.stats).toBeNull();

        reply(request);
        expect(result.current.stats).toBeNull();

        select(4);
        expect(result.current.target?.userId).toBe(22);
        expect(result.current.stats).toBeNull();
    });

    it('clears the target when the server reports it unavailable', () =>
    {
        const { result } = renderHook(() => useTargetStats());
        select(4);
        reply(last(), { available: false, health: 0, energy: 0 });

        expect(result.current.target).toBeNull();
        expect(result.current.stats).toBeNull();
    });

    it('clears the selection on deselection of the same unit only', () =>
    {
        const { result } = renderHook(() => useTargetStats());
        select(4);
        fire(DESELECTED, { id: 9, category: UNIT, roomId: 7 });
        expect(result.current.target?.userId).toBe(22);

        fire(DESELECTED, { id: 4, category: UNIT, roomId: 8 });
        expect(result.current.target?.userId).toBe(22);

        fire(DESELECTED, { id: 4, category: UNIT, roomId: 7 });
        expect(result.current.target).toBeNull();
    });

    it('clears the target when the selected unit is removed from the room', () =>
    {
        const { result } = renderHook(() => useTargetStats());
        select(4);

        fire(USER_REMOVED, { id: 9, category: UNIT, roomId: 7 });
        expect(result.current.target?.userId).toBe(22);

        fire(USER_REMOVED, { id: 4, category: UNIT, roomId: 7 });
        expect(result.current.target).toBeNull();
    });

    it('stops polling and clears on room change without restoring the target when returning', () =>
    {
        const { result, rerender } = renderHook(() => useTargetStats());
        select(4);
        const sentBefore = test.sent.length;

        test.roomId = 8;
        rerender();
        expect(result.current.target).toBeNull();

        act(() => vi.advanceTimersByTime(3000));
        expect(test.sent).toHaveLength(sentBefore);

        test.roomId = 7;
        rerender();
        expect(result.current.target).toBeNull();
    });

    it('stops polling on disconnect and does not restore the target on reconnect', () =>
    {
        const { result, rerender } = renderHook(() => useTargetStats());
        select(4);
        const sentBefore = test.sent.length;

        test.authenticated = false;
        rerender();
        expect(result.current.target).toBeNull();
        act(() => vi.advanceTimersByTime(3000));
        expect(test.sent).toHaveLength(sentBefore);

        test.authenticated = true;
        rerender();
        expect(result.current.target).toBeNull();
    });

    it('clears when the selected user leaves and does not restore them if they rejoin', () =>
    {
        const { result, rerender } = renderHook(() => useTargetStats());
        select(4);

        test.users = test.users.filter((user) => user.webID !== 22);
        rerender();
        expect(result.current.target).toBeNull();

        test.users.push(human(4, 22, 'Mara'));
        rerender();
        expect(result.current.target).toBeNull();
    });

    it('does not show a target when a stale room index now belongs to a different user', () =>
    {
        const { result, rerender } = renderHook(() => useTargetStats());
        select(4);

        test.users = test.users.map((user) => (user.roomIndex === 4 ? human(4, 99, 'Other') : user));
        rerender();
        expect(result.current.target).toBeNull();
    });

    it('reflects a changed name and figure for the same user from the reactive room snapshot', () =>
    {
        const { result, rerender } = renderHook(() => useTargetStats());
        select(4);

        test.users = test.users.map((user) => (user.roomIndex === 4 ? { ...user, name: 'Mara B', figure: 'hd-180-2' } : user));
        rerender();
        expect(result.current.target).toEqual({ userId: 22, name: 'Mara B', figure: 'hd-180-2', sex: 'F' });
        expect(test.sent).toHaveLength(1);
    });
});
