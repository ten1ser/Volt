import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GetRoomObjectBounds } from '../../../api';
import { roomEffectAmountText, RoomEffectsView } from './RoomEffectsView';

interface TestEffect
{
    id: number;
    kind: number;
    targetVirtualId: number;
    sourceVirtualId: number;
    amount: number;
}

const test = vi.hoisted(() => ({
    effects: [] as TestEffect[],
    roomSession: { roomId: 5 },
    bounds: null
}));

vi.mock('@volt/renderer', () => ({ RoomObjectCategory: { UNIT: 20 } }));
vi.mock('../../../hooks/rooms/useRoom', () => ({ useRoom: () => ({ roomSession: test.roomSession }) }));
vi.mock('../../../hooks/roleplay/useRpRoomEffects', () => ({ useRpRoomEffects: () => test.effects }));
vi.mock('../../../api', () => ({
    AddAnimationTickerCallback: vi.fn(() => () => undefined),
    GetRoomObjectBounds: vi.fn(() => test.bounds)
}));

describe('roomEffectAmountText', () =>
{
    const of = (kind: number) => roomEffectAmountText(kind, 10);

    it('shows damage for a landed punch and shot only', () =>
    {
        expect(of(0)).toEqual({ text: '-10', tone: 'damage' });
        expect(of(1)).toBeNull();
        expect(of(2)).toEqual({ text: '-10', tone: 'damage' });
        expect(of(3)).toBeNull();
        expect(of(4)).toBeNull();
        expect(of(5)).toBeNull();
    });

    it('shows a heal and a robbed loss', () =>
    {
        expect(of(6)).toEqual({ text: '+10', tone: 'heal' });
        expect(of(7)).toEqual({ text: '-$10', tone: 'coins' });
    });

    it('stays hidden without a positive amount', () =>
    {
        for(let kind = 0; kind <= 7; kind++) expect(roomEffectAmountText(kind, 0)).toBeNull();
        expect(roomEffectAmountText(0, -3)).toBeNull();
    });
});

describe('RoomEffectsView', () =>
{
    beforeEach(() =>
    {
        test.effects = [];
        test.roomSession = { roomId: 5 };
        test.bounds = { left: 100, top: 50, width: 40, height: 88 };
        vi.mocked(GetRoomObjectBounds).mockClear();
    });
    afterEach(() => cleanup());

    it('draws the effect sprite on the target avatar and its floating number above the head', () =>
    {
        test.effects = [{ id: 1, kind: 6, targetVirtualId: 7, sourceVirtualId: 3, amount: 25 }];
        const { container } = render(<RoomEffectsView />);
        const effect = container.querySelector<HTMLElement>('.rp-room-effect');

        expect(effect).toHaveClass('rp-room-effect--heal');
        expect(effect.style.visibility).toBe('visible');
        expect(effect.style.left).toBe('120px');
        expect(effect.style.top).toBe('138px');
        expect(effect.style.getPropertyValue('--rp-fx-scale')).toBe('1');
        expect(effect.querySelector('.rp-room-effect__sprite')).not.toBeNull();
        expect(GetRoomObjectBounds).toHaveBeenCalledWith(5, 7, 20, 1);

        const amount = container.querySelector<HTMLElement>('.rp-room-effect__amount--heal');

        expect(amount).toHaveTextContent('+25');
        expect(amount.style.top).toBe('-88px');
    });

    it('hides an effect whose avatar bounds are unknown', () =>
    {
        test.bounds = null;
        test.effects = [{ id: 1, kind: 0, targetVirtualId: 7, sourceVirtualId: 3, amount: 9 }];
        const { container } = render(<RoomEffectsView />);

        expect(container.querySelector<HTMLElement>('.rp-room-effect').style.visibility).toBe('hidden');
    });

    it('drops unknown kinds, an empty list and the view without a room', () =>
    {
        test.effects = [{ id: 1, kind: 9, targetVirtualId: 7, sourceVirtualId: 3, amount: 0 }];
        const { container, rerender } = render(<RoomEffectsView />);

        expect(container.querySelector('.rp-room-effect')).toBeNull();
        test.effects = [];
        rerender(<RoomEffectsView />);
        expect(container.querySelector('.rp-room-effects')).toBeNull();
        test.effects = [{ id: 1, kind: 0, targetVirtualId: 7, sourceVirtualId: 3, amount: 9 }];
        test.roomSession = null;
        rerender(<RoomEffectsView />);
        expect(container.querySelector('.rp-room-effects')).toBeNull();
    });
});
