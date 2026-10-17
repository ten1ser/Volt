import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CityBackdrop } from './CityBackdrop';
import { updateCityBackdrop } from '../../../hooks/rooms/updateCityBackdrop';

const test = vi.hoisted(() => ({ city: { backdropColor: 0xabcdef },
    room: { roomBackground: { tint: 0, destroyed: false }, originalRoomBackgroundColor: 0, backgroundPreview: false } }));
vi.mock('../../../hooks/roleplay/useCityStatus', () => ({ useCityStatus: () => ({ city: test.city }) }));
vi.mock('../../../hooks/rooms/useRoom', () => ({ useRoom: () => ({ setCityBackdropColor: (color: number | null) =>
    updateCityBackdrop(test.room.roomBackground, color, test.room.originalRoomBackgroundColor, test.room.backgroundPreview) }) }));
afterEach(() =>
{
    cleanup(); test.city = { backdropColor: 0xabcdef };
    test.room = { roomBackground: { tint: 0, destroyed: false }, originalRoomBackgroundColor: 0, backgroundPreview: false };
});
describe('room backdrop', () =>
{
    it('changes only the backdrop sprite and resets when city status disappears', () =>
    {
        const view = render(<CityBackdrop />);
        expect(test.room.roomBackground.tint).toBe(0xabcdef);
        test.city = null; view.rerender(<CityBackdrop />);
        expect(test.room.roomBackground.tint).toBe(0);
    });
    it('preserves explicit room backgrounds and active color previews', () =>
    {
        test.room.originalRoomBackgroundColor = test.room.roomBackground.tint = 0xff0000;
        const view = render(<CityBackdrop />);
        expect(test.room.roomBackground.tint).toBe(0xff0000);
        test.room.originalRoomBackgroundColor = 0;
        test.room.backgroundPreview = true;
        test.room.roomBackground.tint = 0x123456;
        view.rerender(<CityBackdrop />);
        expect(test.room.roomBackground.tint).toBe(0x123456);
        test.room.backgroundPreview = false;
        view.rerender(<CityBackdrop />);
        expect(test.room.roomBackground.tint).toBe(0xabcdef);
    });
    it('preserves a room override even when its selected background is black', () =>
    {
        updateCityBackdrop(test.room.roomBackground, 0xabcdef, 0, true);
        expect(test.room.roomBackground.tint).toBe(0);
    });
});
