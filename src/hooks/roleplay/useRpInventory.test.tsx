import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryAction, useRpInventory } from './useRpInventory';

const test = vi.hoisted(() => ({ authenticated: true, send: vi.fn(), receive: null }));
vi.mock('@volt/renderer', () => ({
    RoomObjectCategory: { UNIT: 100 }, RoomObjectType: { USER: 'user' },
    RpInventoryEvent: class
    {},
    RpInventoryRequestComposer: class
    {
        constructor(public id: number, public action: number, public from: number, public to: number, public target: number)
        {}
    } }));
vi.mock('../../api/volt/SendMessageComposer', () => ({ SendMessageComposer: test.send }));
vi.mock('../../api/room/events/RoomWidgetUpdateRoomObjectEvent', () => ({ RoomWidgetUpdateRoomObjectEvent: { OBJECT_SELECTED: 'selected', OBJECT_DESELECTED: 'deselected' } }));
vi.mock('../events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../events/useUiEvent', () => ({ useUiEvent: vi.fn() }));
vi.mock('../session/useSessionSnapshots', () => ({ useRoomUserListSnapshot: () => [], useUserDataSnapshot: () => ({ userId: 1 }) }));
vi.mock('../events/useMessageEvent', () => ({ useMessageEvent: (_type: unknown, receive: (event: unknown) => void) =>
{
    test.receive = receive;
} }));

const slots = (first = '') => Array.from({ length: 10 }, (_, index) => index === 0 && first
    ? { slot: 1, key: first, name: first, kind: 1, quantity: 1, durability: 0, maxDurability: 0 }
    : { slot: index + 1, key: '', name: '', kind: 0, quantity: 0, durability: 0, maxDurability: 0 });
const reply = (result: number, message = '', first = '') =>
    act(() => test.receive?.({ getParser: () => ({ requestId: 0, result, message, slots: slots(first) }) }));
const sent = () => test.send.mock.calls.map(call => [call[0].action, call[0].from, call[0].to, call[0].target]);

describe('Backpack requests', () =>
{
    beforeEach(() =>
    {
        test.authenticated = true; test.send.mockClear();
    });
    afterEach(cleanup);

    it('reads the backpack when it opens and only then', () =>
    {
        const view = renderHook(({ open }) => useRpInventory(open), { initialProps: { open: false } });
        expect(test.send).not.toHaveBeenCalled();
        view.rerender({ open: true });
        expect(sent()).toEqual([[InventoryAction.Read, 0, 0, 0]]);
        expect(test.send.mock.calls[0][0].id).toBeGreaterThan(0);
    });

    it('sends moves, uses and drops with their slots', () =>
    {
        const view = renderHook(() => useRpInventory(true));
        act(() =>
        {
            view.result.current.move(3, 1); view.result.current.use(4); view.result.current.drop(5, 42);
        });
        expect(sent().slice(1)).toEqual([[1, 3, 1, 0], [2, 4, 0, 0], [3, 5, 0, 42]]);
    });

    it('replaces the slots on every snapshot, including pushes', () =>
    {
        const view = renderHook(() => useRpInventory(true));
        reply(0, '', 'pistol');
        expect(view.result.current.slots[0].key).toBe('pistol');
        reply(0);
        expect(view.result.current.slots[0].key).toBe('');
    });

    it('shows refusals as a notice', () =>
    {
        const view = renderHook(() => useRpInventory(true));
        reply(1, 'Your backpack is full.');
        expect(view.result.current.notice).toBe('Your backpack is full.');
        act(() => view.result.current.clearNotice());
        expect(view.result.current.notice).toBe('');
    });

    it('asks before destroying a dropped item and destroys only on confirm', () =>
    {
        const view = renderHook(() => useRpInventory(true));
        act(() => view.result.current.drop(6, 0));
        reply(2, 'Nobody is next to you. Destroy your MP5?');
        expect(view.result.current.pendingDestroy).toEqual({ slot: 6, message: 'Nobody is next to you. Destroy your MP5?' });
        act(() => view.result.current.confirmDestroy());
        expect(sent().at(-1)).toEqual([InventoryAction.Destroy, 6, 0, 0]);
        expect(view.result.current.pendingDestroy).toBeNull();
    });

    it('cancelling a destroy sends nothing', () =>
    {
        const view = renderHook(() => useRpInventory(true));
        act(() => view.result.current.drop(6, 0));
        reply(2, 'Destroy?');
        const before = test.send.mock.calls.length;
        act(() => view.result.current.cancelDestroy());
        expect(test.send.mock.calls.length).toBe(before);
        expect(view.result.current.pendingDestroy).toBeNull();
    });
});
