import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DistrictHud, displayRoomName } from './DistrictHud';
import moonIcon from '../../../assets/images/roleplay/phone/moon.png';
import sunIcon from '../../../assets/images/roleplay/phone/sun.png';
import roomIcon from '../../../assets/images/roleplay/room-icon.svg';
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
    vi.restoreAllMocks();
});
describe('phone-first HUD', () =>
{
    it('shows only the wordmark, the clock and the room name at the top; coins and online count live in the phone', () =>
    {
        render(<DistrictHud />);
        expect(screen.getByText('DistrictRP City')).toBeInTheDocument();
        expect(screen.getByTitle('City time')).toHaveTextContent('12:30');
        expect(screen.queryByText(/min left/)).toBeNull();
        expect(screen.queryByTitle('RP Coins')).toBeNull();
        expect(screen.queryByText(/online/)).toBeNull();
        expect(screen.getByAltText('DistrictRP')).toHaveClass('district-wordmark');
        expect(document.querySelector('.district-topbar').contains(screen.getByAltText('DistrictRP'))).toBe(false);
        expect(document.querySelector('.district-location__icon')).toHaveAttribute('src', roomIcon);
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
        // Minimal corner: the room name over the time chip, no hotel icon.
        const topbar = document.querySelector('.district-topbar');
        expect(topbar.firstElementChild).toBe(chip);
        expect(topbar.lastElementChild).toHaveClass('district-clock');
        const icon = chip.querySelector('img.district-location__icon');
        expect(icon).toHaveAttribute('src', roomIcon);
        expect(icon).toHaveAttribute('alt', '');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(icon).toHaveAttribute('draggable', 'false');
        expect(icon).toHaveAttribute('width', '24');
        expect(icon).toHaveAttribute('height', '24');
        expect(chip).toHaveAccessibleName('Regency Café');
        expect(topbar.querySelector('.district-clock img')).toHaveAttribute('src', sunIcon);
        expect(topbar.querySelectorAll('time')).toHaveLength(1);
        expect(screen.queryByText(/min left/)).toBeNull();
        fireEvent.click(chip);
        expect(useRoomToolsMenuStore.getState().open).toBe(true);
        expect(chip).toHaveAttribute('aria-expanded', 'true');
        test.roomSession = null; view.rerender(<DistrictHud />);
        expect(screen.queryByRole('button', { name: /DistrictRP City/ })).toBeNull();
        useRoomToolsMenuStore.setState({ open: false });
    });
    it('shows the room name without its navigator tag and keeps the full name as the tooltip', () =>
    {
        test.roomSession = { roomId: 1 }; test.room = { roomId: 1, roomName: '[HOSP] District Hospital' };
        test.city = { time: '01:20', isDay: false, phaseRemainingMs: 60000, onlinePlayers: 1 };
        render(<DistrictHud />);
        const chip = screen.getByRole('button', { name: 'District Hospital' });
        expect(chip).toHaveAttribute('title', '[HOSP] District Hospital · room tools');
        expect(document.querySelector('.district-clock img')).toHaveAttribute('src', moonIcon);
        expect(displayRoomName('[DEV] Exterior Build Lab')).toBe('Exterior Build Lab');
        expect(displayRoomName('Regency Café')).toBe('Regency Café');
        expect(displayRoomName('[HOSP]')).toBe('[HOSP]');
    });
    it('uses an honest placeholder before synchronization', () =>
    {
        test.city = null;
        render(<DistrictHud />);
        expect(screen.getByTitle('Synchronizing city time')).toHaveTextContent('--:--');
    });
    it('keeps the player-card host outside the scaled vitals and follows their measured bounds', () =>
    {
        render(<DistrictHud />);
        const vitals = document.querySelector('.district-vitals') as HTMLElement;
        const host = document.getElementById('district-player-card') as HTMLElement;

        expect(host).not.toBeNull();
        expect(host).toHaveClass('district-player-card');
        expect(vitals.contains(host)).toBe(false);

        const rect = { left: 120, top: 16, right: 400, bottom: 300, width: 280, height: 284, x: 120, y: 16, toJSON: () => ({}) };

        vi.spyOn(vitals, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(host).toHaveStyle({ left: '120px', top: '310px' });
        expect(host.style.getPropertyValue('--district-card-left')).toBe('120px');
        expect(host.style.getPropertyValue('--district-card-max-height')).toBe(`${window.innerHeight - 310 - 16}px`);
        expect(host.style.maxHeight).toBe(`${window.innerHeight - 310 - 16}px`);

        rect.bottom = 340;
        rect.height = 324;
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(host).toHaveStyle({ top: '350px' });
        expect(host.style.maxHeight).toBe(`${window.innerHeight - 350 - 16}px`);
    });
    it('places the other player card under the target HUD when it sits beside yours, else next to your card', () =>
    {
        render(<DistrictHud />);
        const vitals = document.querySelector('.district-vitals') as HTMLElement;
        const host = document.getElementById('district-target-card') as HTMLElement;

        expect(host).toHaveClass('district-player-card');
        expect(vitals.contains(host)).toBe(false);

        vi.spyOn(vitals, 'getBoundingClientRect').mockReturnValue({ left: 120, top: 16, right: 700, bottom: 300, width: 580, height: 284, x: 120, y: 16, toJSON: () => ({}) } as DOMRect);
        act(() => { window.dispatchEvent(new Event('resize')); });

        // No target HUD: one card width (208) plus a 10px gap to the right of your card.
        expect(host).toHaveStyle({ left: '338px', top: '310px' });

        const target = document.createElement('section');
        target.className = 'rp-target-hud';
        vitals.appendChild(target);
        const targetRect = vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ left: 420 } as DOMRect);
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(host).toHaveStyle({ left: '420px', top: '310px' });

        // Narrow layout stacks the target HUD under yours (same left): fall back to beside your card.
        targetRect.mockReturnValue({ left: 120 } as DOMRect);
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(host).toHaveStyle({ left: '338px' });
    });
});
