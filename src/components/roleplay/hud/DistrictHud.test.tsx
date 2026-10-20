import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DistrictHud } from './DistrictHud';

interface TestState
{
    link: ReturnType<typeof vi.fn>;
    city: { time: string; isDay: boolean; phaseRemainingMs: number; onlinePlayers: number } | null;
    roomSession: { roomId: number } | null;
    room: { roomId: number; roomName: string } | null;
    credits: number;
}

const test: TestState = vi.hoisted(() => ({ link: vi.fn(),
    city: { time: '12:30', isDay: true, phaseRemainingMs: 450000, onlinePlayers: 32 },
    roomSession: null, room: null, credits: 50200 }));
vi.mock('@volt/renderer', () => ({ CreateLinkEvent: test.link }));
vi.mock('../../../api', () => ({ localizeWithFallback: (_key: string, fallback: string) => fallback }));
vi.mock('../../../hooks', () => ({ usePurse: () => ({ purse: { credits: test.credits } }) }));
vi.mock('../../../hooks/roleplay/useCityStatus', () => ({ useCityStatus: () => ({ city: test.city }) }));
vi.mock('../../../hooks/rooms/useRoom', () => ({ useRoom: () => ({ roomSession: test.roomSession }) }));
vi.mock('../../../hooks/navigator/useNavigatorData', () => ({ useNavigatorData: () => ({ navigatorData: { enteredGuestRoom: test.room } }) }));
afterEach(() =>
{
    cleanup(); test.roomSession = test.room = null; test.link.mockClear(); test.credits = 50200;
    test.city = { time: '12:30', isDay: true, phaseRemainingMs: 450000, onlinePlayers: 32 };
});
describe('city-status top bar', () =>
{
    it('shows the location chip and the city chip with RP Coins, online count and settings', () =>
    {
        render(<DistrictHud />);
        expect(screen.getByText('DistrictRP City')).toBeInTheDocument();
        expect(screen.getByText('12:30')).toBeInTheDocument();
        expect(screen.getByText('Day · 8 min left')).toBeInTheDocument();
        expect(screen.getByTitle('RP Coins')).toHaveTextContent('50,200');
        expect(screen.getByText('32 online')).toBeInTheDocument();
        expect(screen.queryByText('Diamonds')).toBeNull();
        expect(screen.queryByText('Duckets')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        expect(test.link).toHaveBeenCalledWith('user-settings/show/other');
    });
    it('keeps the RP Coins amount between the phase and the online count', () =>
    {
        const view = render(<DistrictHud />);
        const coins = screen.getByTitle('RP Coins');
        const phase = screen.getByText('Day · 8 min left');
        const online = screen.getByText('32 online');
        expect(phase.compareDocumentPosition(coins) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(coins.compareDocumentPosition(online) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        test.credits = 0;
        view.rerender(<DistrictHud />);
        expect(screen.getByTitle('RP Coins')).toHaveTextContent('0');
    });
    it('renders only the top bar so the command bar and room stay clear', () =>
    {
        const view = render(<DistrictHud />);
        expect(document.querySelector('.district-command-bar')).toBeNull();
        expect(document.querySelector('.district-topbar')).not.toBeNull();
        expect(view.container.querySelectorAll('header')).toHaveLength(1);
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
    it('uses honest placeholders before synchronization', () =>
    {
        test.city = null;
        render(<DistrictHud />);
        expect(screen.getByText('--:--')).toBeInTheDocument();
        expect(screen.getByText('— online')).toBeInTheDocument();
        expect(screen.getByText('Synchronizing city time')).toBeInTheDocument();
    });
});
