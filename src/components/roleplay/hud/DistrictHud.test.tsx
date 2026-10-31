import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DistrictHud } from './DistrictHud';
import { useRoomToolsMenuStore } from '../../room/widgets/room-tools/roomToolsMenuStore';

interface TestState
{
    city: { time: string; isDay: boolean; phaseRemainingMs: number; onlinePlayers: number } | null;
    roomSession: { roomId: number } | null;
    room: { roomId: number; roomName: string } | null;
}

const test: TestState = vi.hoisted(() => ({
    city: { time: '12:30', isDay: true, phaseRemainingMs: 450000, onlinePlayers: 32 },
    roomSession: null, room: null }));
vi.mock('../../../hooks/roleplay/useCityStatus', () => ({ useCityStatus: () => ({ city: test.city }) }));
vi.mock('../../../hooks/rooms/useRoom', () => ({ useRoom: () => ({ roomSession: test.roomSession }) }));
vi.mock('../../../hooks/navigator/useNavigatorData', () => ({ useNavigatorData: () => ({ navigatorData: { enteredGuestRoom: test.room } }) }));
vi.mock('../stats/StatsHud', () => ({ StatsHud: () => <section aria-label="Your stats" /> }));
vi.mock('../stats/TargetHud', () => ({ TargetHud: () => <section aria-label="Target stats" /> }));
afterEach(() =>
{
    cleanup(); test.roomSession = test.room = null;
    test.city = { time: '12:30', isDay: true, phaseRemainingMs: 450000, onlinePlayers: 32 };
});
describe('phone-first HUD', () =>
{
    it('shows only the clock and the room name at the top; coins, online count and logo live in the phone', () =>
    {
        render(<DistrictHud />);
        expect(screen.getByText('DistrictRP City')).toBeInTheDocument();
        expect(screen.getByTitle('City time · Day')).toHaveTextContent('12:30');
        expect(screen.queryByText(/min left/)).toBeNull();
        expect(screen.queryByTitle('RP Coins')).toBeNull();
        expect(screen.queryByText(/online/)).toBeNull();
        expect(screen.queryByAltText('DistrictRP')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    });
    it('puts the own vitals above the target card, outside the top-right bar', () =>
    {
        render(<DistrictHud />);
        const vitals = document.querySelector('.district-vitals');
        expect([...vitals.children].map(card => card.getAttribute('aria-label'))).toEqual(['Your stats', 'Target stats']);
        expect(document.querySelector('.district-topbar').contains(vitals)).toBe(false);
        expect(document.querySelector('.district-command-bar')).toBeNull();
    });
    it('does not show stale room metadata during navigation or on the hotel view', () =>
    {
        test.roomSession = { roomId: 1 }; test.room = { roomId: 1, roomName: 'Regency Café' };
        const view = render(<DistrictHud />);
        expect(screen.getByText('Regency Café')).toBeInTheDocument();
        test.roomSession = { roomId: 2 }; view.rerender(<DistrictHud />);
        expect(screen.queryByText('Regency Café')).toBeNull();
        expect(screen.getByText('Entering room…')).toBeInTheDocument();
        test.roomSession = null; view.rerender(<DistrictHud />);
        expect(screen.getByText('DistrictRP City')).toBeInTheDocument();
    });
    it('opens the room tools from the room name only inside a room', () =>
    {
        useRoomToolsMenuStore.setState({ open: false });
        test.roomSession = { roomId: 1 }; test.room = { roomId: 1, roomName: 'Regency Café' };
        const view = render(<DistrictHud />);
        const chip = screen.getByRole('button', { name: /Regency Café/ });
        expect(chip).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(chip);
        expect(useRoomToolsMenuStore.getState().open).toBe(true);
        expect(chip).toHaveAttribute('aria-expanded', 'true');
        test.roomSession = null; view.rerender(<DistrictHud />);
        expect(screen.queryByRole('button', { name: /DistrictRP City/ })).toBeNull();
        useRoomToolsMenuStore.setState({ open: false });
    });
    it('uses an honest placeholder before synchronization', () =>
    {
        test.city = null;
        render(<DistrictHud />);
        expect(screen.getByTitle('Synchronizing city time')).toHaveTextContent('--:--');
    });
});
