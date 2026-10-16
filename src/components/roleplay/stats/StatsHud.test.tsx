import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatsHud } from './StatsHud';

const test = vi.hoisted(() => ({ authenticated: true, send: vi.fn(), receive: null, user: { userName: 'DistrictPlayer', figure: 'hr-100-61', gender: 'M' } }));
vi.mock('../../../hooks/session/useSessionSnapshots', () => ({ useUserDataSnapshot: () => test.user }));
vi.mock('../../../common/layout/LayoutAvatarImageView', () => ({ LayoutAvatarImageView: ({ figure, gender }: { figure: string; gender: string }) => <div data-testid="player-avatar" data-figure={figure} data-gender={gender} /> }));
vi.mock('@volt/renderer', () => ({ RpStatsEvent: class
{}, RpStatsRequestComposer: class
{} }));
vi.mock('../../../api/utils/LocalizeText', () => ({ LocalizeText: (key: string) => key }));
vi.mock('../../../api/volt/SendMessageComposer', () => ({ SendMessageComposer: test.send }));
vi.mock('../../../hooks/events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../../../hooks/events/useMessageEvent', () => ({ useMessageEvent: (_type: unknown, receive: (event: unknown) => void) =>
{
    test.receive = receive;
} }));

const snapshot = (health: number, energy: number) => act(() => test.receive?.({ getParser: () => ({ health, energy }) }));

describe('DistrictRP stats HUD', () =>
{
    beforeEach(() =>
    {
        test.user = { userName: 'DistrictPlayer', figure: 'hr-100-61', gender: 'M' };
        test.authenticated = true; test.send.mockClear(); vi.useFakeTimers();
    });
    afterEach(() =>
    {
        cleanup(); vi.useRealTimers();
    });

    it('requests own stats after mounting and stays hidden before a server reply', () =>
    {
        render(<StatsHud />);
        expect(test.send).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('region')).toBeNull();
    });

    it('renders authoritative values and updates both accessible bars when a new packet arrives', () =>
    {
        render(<StatsHud />);
        snapshot(100, 100);
        expect(screen.getByRole('progressbar', { name: 'Health' })).toHaveAttribute('aria-valuenow', '100');
        snapshot(73, 29);
        expect(screen.getByRole('progressbar', { name: 'Health' })).toHaveAttribute('aria-valuenow', '73');
        expect(screen.getByRole('progressbar', { name: 'Energy' })).toHaveAttribute('aria-valuenow', '29');
        expect(screen.getByText('73 / 100')).toBeInTheDocument();
    });

    it('refreshes periodically and stops polling when the HUD unmounts', () =>
    {
        const view = render(<StatsHud />);
        act(() => vi.advanceTimersByTime(15000));
        expect(test.send).toHaveBeenCalledTimes(2);
        view.unmount();
        act(() => vi.advanceTimersByTime(30000));
        expect(test.send).toHaveBeenCalledTimes(2);
    });

    it('keeps the player name and portrait in sync with the session snapshot', () =>
    {
        const view = render(<StatsHud />);
        snapshot(100, 100);
        expect(screen.getByText('DistrictPlayer')).toBeInTheDocument();
        expect(screen.getByTestId('player-avatar')).toHaveAttribute('data-figure', 'hr-100-61');
        test.user = { userName: 'UpdatedPlayer', figure: 'hr-200-45', gender: 'F' };
        view.rerender(<StatsHud />);
        expect(screen.getByText('UpdatedPlayer')).toBeInTheDocument();
        expect(screen.queryByText('DistrictPlayer')).toBeNull();
        expect(screen.getByTestId('player-avatar')).toHaveAttribute('data-figure', 'hr-200-45');
        expect(screen.getByTestId('player-avatar')).toHaveAttribute('data-gender', 'F');
    });

    it('hides stats and cancels refreshes when disconnected', () =>
    {
        const view = render(<StatsHud />);
        snapshot(50, 40);
        test.authenticated = false;
        view.rerender(<StatsHud />);
        expect(screen.queryByRole('region')).toBeNull();
        act(() => vi.advanceTimersByTime(30000));
        expect(test.send).toHaveBeenCalledTimes(1);
    });
});
