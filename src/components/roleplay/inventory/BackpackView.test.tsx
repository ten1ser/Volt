import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackpackView } from './BackpackView';

const test = vi.hoisted(() => ({
    tracker: null,
    move: vi.fn(), use: vi.fn(), drop: vi.fn(), confirmDestroy: vi.fn(), cancelDestroy: vi.fn(),
    slots: [] as any[], pendingDestroy: null, target: 0
}));
vi.mock('@volt/renderer', () => ({ AddLinkEventTracker: (tracker: any) =>
{
    test.tracker = tracker;
}, RemoveLinkEventTracker: vi.fn() }));
vi.mock('../../../common', () => ({ VoltCardView: ({ children }: any) => <div>{children}</div> }));
vi.mock('../../../hooks/roleplay/useRpInventory', () => ({
    useRpInventory: () => ({ slots: test.slots, notice: '', clearNotice: vi.fn(), pendingDestroy: test.pendingDestroy, move: test.move, use: test.use,
        drop: test.drop, confirmDestroy: test.confirmDestroy, cancelDestroy: test.cancelDestroy, authenticated: true }),
    useSelectedUserId: () => test.target
}));

const empty = (slot: number) => ({ slot, key: '', name: '', kind: 0, quantity: 0, durability: 0, maxDurability: 0 });
const backpack = () => [
    { slot: 1, key: 'pistol', name: 'Glock 17', kind: 1, quantity: 1, durability: 0, maxDurability: 0 },
    { slot: 2, key: 'vest', name: 'Armor Vest', kind: 2, quantity: 1, durability: 60, maxDurability: 100 },
    { slot: 3, key: 'mp5', name: 'MP5', kind: 1, quantity: 1, durability: 0, maxDurability: 0 },
    ...[4, 5, 6, 7, 8, 9, 10].map(empty)
];
const open = () =>
{
    render(<BackpackView />); act(() => test.tracker?.linkReceived('backpack/show'));
};

describe('Backpack window', () =>
{
    beforeEach(() =>
    {
        test.slots = backpack(); test.pendingDestroy = null; test.target = 0;
        [test.move, test.use, test.drop, test.confirmDestroy, test.cancelDestroy].forEach(fn => fn.mockClear());
    });
    afterEach(cleanup);

    it('stays closed until toggled and shows 10 slots with weapon and armor captions', () =>
    {
        render(<BackpackView />);
        expect(screen.queryByRole('dialog')).toBeNull();
        act(() => test.tracker?.linkReceived('backpack/toggle'));
        expect(screen.getAllByRole('button', { name: /^Slot \d+:/ })).toHaveLength(10);
        expect(screen.getByText('Weapon')).toBeInTheDocument();
        expect(screen.getByText('Armor')).toBeInTheDocument();
        expect(screen.getByText('3 of 10 slots used')).toBeInTheDocument();
    });

    it('double-click uses a slot and selecting shows its details', () =>
    {
        open();
        fireEvent.doubleClick(screen.getByRole('button', { name: 'Slot 3: MP5' }));
        expect(test.use).toHaveBeenCalledWith(3);
        fireEvent.click(screen.getByRole('button', { name: 'Slot 2: Armor Vest' }));
        expect(screen.getByText(/Armor · 60\/100/)).toBeInTheDocument();
    });

    it('dragging an item onto another slot moves it', () =>
    {
        open();
        const data = { setData: vi.fn(), getData: () => '3' };
        fireEvent.dragStart(screen.getByRole('button', { name: 'Slot 3: MP5' }), { dataTransfer: data });
        fireEvent.drop(screen.getByRole('button', { name: 'Slot 1: Glock 17' }), { dataTransfer: data });
        expect(test.move).toHaveBeenCalledWith(3, 1);
    });

    it('Drop hands the selected item to the selected player', () =>
    {
        test.target = 42;
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Slot 3: MP5' }));
        fireEvent.click(screen.getByRole('button', { name: 'Drop' }));
        expect(test.drop).toHaveBeenCalledWith(3, 42);
    });

    it('shows the destroy confirmation and passes the answer on', () =>
    {
        test.pendingDestroy = { slot: 3, message: 'Nobody is next to you. Destroy your MP5?' };
        open();
        expect(screen.getByText('Nobody is next to you. Destroy your MP5?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Destroy' }));
        expect(test.confirmDestroy).toHaveBeenCalled();
    });
});
