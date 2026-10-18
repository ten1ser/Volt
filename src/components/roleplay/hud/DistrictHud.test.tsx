import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DistrictHud } from './DistrictHud';

const test = vi.hoisted(() => ({ link: vi.fn(), credits: 50200,
    city: { time: '12:30', isDay: true, phaseRemainingMs: 450000, onlinePlayers: 32 },
    roomSession: null, room: null }));
vi.mock('@volt/renderer', () => ({ CreateLinkEvent: test.link }));
vi.mock('../../../api', () => ({ localizeWithFallback: (_key: string, fallback: string) => fallback }));
vi.mock('../../../hooks', () => ({ usePurse: () => ({ purse: { credits: test.credits } }) }));
vi.mock('../../../hooks/roleplay/useCityStatus', () => ({ useCityStatus: () => ({ city: test.city }) }));
vi.mock('../../../hooks/rooms/useRoom', () => ({ useRoom: () => ({ roomSession: test.roomSession }) }));
vi.mock('../../../hooks/navigator/useNavigatorData', () => ({ useNavigatorData: () => ({ navigatorData: { enteredGuestRoom: test.room } }) }));
vi.mock('../stats/StatsHud', () => ({ StatsHud: () => <section aria-label="Your stats" /> }));
vi.mock('../stats/TargetHud', () => ({ TargetHud: () => <section aria-label="Target stats" /> }));
afterEach(() =>
{
    cleanup(); test.credits = 50200; test.roomSession = test.room = null; test.link.mockClear();
    test.city = { time: '12:30', isDay: true, phaseRemainingMs: 450000, onlinePlayers: 32 };
});
describe('city-status HUD', () =>
{
    it('shows only native RP Coins and server city time/population with settings access', () =>
    {
        const view = render(<DistrictHud />);
        expect(screen.getByText('50,200')).toBeInTheDocument();
        expect(screen.getByText('12:30')).toBeInTheDocument();
        expect(screen.getByText('32 online')).toBeInTheDocument();
        expect(screen.getByText('DistrictRP City')).toBeInTheDocument();
        expect(screen.queryByText('Diamonds')).toBeNull();
        expect(screen.queryByText('Duckets')).toBeNull();
        test.credits = 49900; view.rerender(<DistrictHud />);
        expect(screen.getByText('49,900')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        expect(test.link).toHaveBeenCalledWith('user-settings/show/other');
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
    it('places own and target vitals in the same district-vitals wrapper', () =>
    {
        render(<DistrictHud />);
        const own = screen.getByLabelText('Your stats').closest('.district-vitals');
        expect(own).not.toBeNull();
        expect(screen.getByLabelText('Target stats').closest('.district-vitals')).toBe(own);
    });
    it('uses honest placeholders before synchronization', () =>
    {
        test.city = null;
        render(<DistrictHud />);
        expect(screen.getByText('--:--')).toBeInTheDocument();
        expect(screen.getByText('— online')).toBeInTheDocument();
    });
});
