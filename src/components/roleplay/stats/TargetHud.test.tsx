import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TargetHud } from './TargetHud';

const test = vi.hoisted(() => ({
    value: null as any,
    link: vi.fn(),
    roomSession: { roomId: 1 } as any
}));

vi.mock('@volt/renderer', () => ({ CreateLinkEvent: (link: string) => test.link(link) }));
vi.mock('../../../hooks/roleplay/useTargetStats', () => ({ useTargetStats: () => test.value }));
vi.mock('../../../hooks/rooms/useRoom', () => ({ useRoom: () => ({ roomSession: test.roomSession }) }));
vi.mock('../../../common/layout/LayoutAvatarImageView', () => ({
    LayoutAvatarImageView: ({ figure, gender, direction, nativeCroppedHead, trimmed, headOnly, compactHead }: any) => (
        <div
            data-testid="target-avatar"
            data-figure={figure}
            data-gender={gender}
            data-direction={direction}
            data-native-cropped-head={String(!!nativeCroppedHead)}
            data-trimmed={String(!!trimmed)}
            data-head-only={String(!!headOnly)}
            data-compact-head={String(!!compactHead)}
        />
    )
}));
vi.mock('../../../api/utils/LocalizeText', () => ({ LocalizeText: (key: string) => key }));

const target = { userId: 22, name: 'Mara', figure: 'hr-200-45', sex: 'F' };

describe('target HUD', () =>
{
    beforeEach(() =>
    {
        test.value = { target, stats: { health: 60, energy: 40 }, clearTarget: vi.fn() };
        test.link.mockClear();
        test.roomSession = { roomId: 1 };
    });

    afterEach(() =>
    {
        cleanup();
    });

    it('renders nothing without a target', () =>
    {
        test.value = { target: null, stats: null, clearTarget: vi.fn() };
        const view = render(<TargetHud />);
        expect(view.container).toBeEmptyDOMElement();
    });

    it('shows the target label, name, portrait and accessible real values', () =>
    {
        render(<TargetHud />);
        expect(screen.getByText('Target')).toBeInTheDocument();
        expect(screen.getByText('Mara')).toBeInTheDocument();
        expect(screen.getByTestId('target-avatar')).toHaveAttribute('data-figure', 'hr-200-45');
        expect(screen.getByTestId('target-avatar')).toHaveAttribute('data-gender', 'F');
        expect(screen.getByTestId('target-avatar')).toHaveAttribute('data-direction', '4');
        expect(screen.getByTestId('target-avatar')).toHaveAttribute('data-native-cropped-head', 'true');
        expect(screen.getByTestId('target-avatar')).toHaveAttribute('data-trimmed', 'true');
        expect(screen.getByTestId('target-avatar')).toHaveAttribute('data-head-only', 'false');
        expect(screen.getByTestId('target-avatar')).toHaveAttribute('data-compact-head', 'false');
        expect(screen.getByRole('progressbar', { name: 'Target health' })).toHaveAttribute('aria-valuenow', '60');
        expect(screen.getByRole('progressbar', { name: 'Target energy' })).toHaveAttribute('aria-valuenow', '40');
        const health = screen.getByRole('progressbar', { name: 'Target health' });
        const energy = screen.getByRole('progressbar', { name: 'Target energy' });
        expect(health).toHaveAttribute('title', '60 / 100');
        expect(energy).toHaveAttribute('title', '40 / 100');
        expect(within(health).getByText('60 / 100')).toBeInTheDocument();
        expect(within(energy).getByText('40 / 100')).toBeInTheDocument();
    });

    it('shows loading text and no fabricated vitals until a validated reply arrives', () =>
    {
        test.value = { target, stats: null, clearTarget: vi.fn() };
        render(<TargetHud />);
        expect(screen.getByRole('status')).toHaveTextContent('Loading…');
        expect(screen.queryByRole('progressbar')).toBeNull();
        expect(screen.queryByText('100 / 100')).toBeNull();
    });

    it('clears the target through the accessible Clear target button', () =>
    {
        const clearTarget = vi.fn();
        test.value = { target, stats: { health: 60, energy: 40 }, clearTarget };
        render(<TargetHud />);
        fireEvent.click(screen.getByRole('button', { name: 'Clear target' }));
        expect(clearTarget).toHaveBeenCalledTimes(1);
    });

    it('exposes the padlock as a toggle and identifies an out-of-room target without fabricated bars', () =>
    {
        const toggleLock = vi.fn();
        test.value = { target, stats: null, clearTarget: vi.fn(), locked: true, unavailable: true, toggleLock };
        render(<TargetHud />);
        const lock = screen.getByRole('button', { name: 'Unlock target' });
        expect(lock).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(lock);
        expect(toggleLock).toHaveBeenCalledOnce();
        expect(screen.getByRole('status')).toHaveTextContent('Target unavailable in this room');
        expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('opens the target card from the accessible portrait toggle', () =>
    {
        render(<TargetHud />);
        const toggle = screen.getByRole('button', { name: 'Toggle target player card' });
        expect(toggle).toHaveAttribute('aria-controls', 'district-player-card');
        expect(toggle).toContainElement(screen.getByTestId('target-avatar'));
        fireEvent.click(toggle);
        expect(test.link).toHaveBeenCalledWith('avatar-info/toggle-user/22');
    });

    it('disables the portrait toggle without a room or an available target', () =>
    {
        test.roomSession = null;
        const view = render(<TargetHud />);
        expect(screen.getByRole('button', { name: 'Toggle target player card' })).toBeDisabled();

        test.roomSession = { roomId: 1 };
        test.value = { target, stats: null, clearTarget: vi.fn(), unavailable: true };
        view.rerender(<TargetHud />);
        expect(screen.getByRole('button', { name: 'Toggle target player card' })).toBeDisabled();
    });
});
