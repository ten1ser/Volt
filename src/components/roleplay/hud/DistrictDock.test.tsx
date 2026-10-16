import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DistrictDock } from './DistrictDock';

const test = vi.hoisted(() => ({ link: vi.fn(), profile: vi.fn(), visit: vi.fn(), moderator: false, camera: false, wired: false, build: false, monitor: vi.fn(), toggleBuild: vi.fn() }));
vi.mock('@volt/renderer', () => ({ CreateLinkEvent: test.link, PerkEnum: { CAMERA: 'camera', USE_GUIDE_TOOL: 'guide' } }));
vi.mock('../../../api', () => ({
    DispatchUiEvent: vi.fn(), GetConfigurationValue: (_key: string, fallback = false) => fallback,
    GetUserProfile: test.profile, localizeWithFallback: (_key: string, fallback: string) => fallback,
    MessengerIconState: { HIDDEN: 0, UNREAD: 2 }, OpenMessengerChat: vi.fn(), VisitDesktop: test.visit
}));
vi.mock('../../../api/permissions', () => ({ Permission: { ModerationTool: 'moderator' } }));
vi.mock('../../../events', () => ({ GuideToolEvent: class
{} }));
vi.mock('../../../hooks', () => ({
    useAchievements: () => ({ getTotalUnseen: 0 }), useDailyTasks: () => ({ unseenCount: 0 }),
    useRewardTracks: () => ({ unseenCount: 0 }), useFriends: () => ({ requests: [] }),
    useInventoryUnseenTracker: () => ({ getFullCount: 3 }), useMessenger: () => ({ iconState: 0 }),
    useHasPermission: () => test.moderator, useOpenIssueCount: () => 2,
    useWiredTools: () => ({ showToolbarButton: test.wired, openMonitor: test.monitor }),
    useBuildHeight: () => ({ available: test.build, toggle: test.toggleBuild })
}));
vi.mock('../../../hooks/session/useSessionSnapshots', () => ({ useUserDataSnapshot: () => ({ userId: 42 }) }));
vi.mock('../../../state/groupForumUnreadStore', () => ({ useGroupForumUnreadStore: (select: (state: { unreadForumsCount: number }) => number) => select({ unreadForumsCount: 0 }) }));
vi.mock('../../../state/perkAllowancesStore', () => ({ usePerkAllowed: (perk: string) => perk === 'camera' && test.camera }));

describe('DistrictRP navigation', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
        test.moderator = false; test.camera = false; test.wired = false; test.build = false;
    });
    afterEach(cleanup);

    it('keeps the room chat portal and routes main actions to existing features', () =>
    {
        render(<DistrictDock isInRoom />);
        expect(document.getElementById('toolbar-chat-input-container')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Rooms' }));
        expect(test.link).toHaveBeenLastCalledWith('navigator/toggle');
        fireEvent.click(screen.getByRole('button', { name: /Inventory/ }));
        expect(test.link).toHaveBeenLastCalledWith('inventory/toggle');
        fireEvent.click(screen.getByRole('button', { name: 'City' }));
        expect(test.visit).toHaveBeenCalledOnce();
    });

    it('opens character actions and uses the authenticated player ID', () =>
    {
        render(<DistrictDock isInRoom />);
        fireEvent.click(screen.getByRole('button', { name: 'Character' }));
        fireEvent.click(screen.getByRole('button', { name: 'My profile' }));
        expect(test.profile).toHaveBeenCalledWith(42);
        expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes a drawer on Escape, restores trigger focus and dismisses outside clicks', () =>
    {
        render(<DistrictDock isInRoom />);
        const trigger = screen.getByRole('button', { name: 'Tools' });
        fireEvent.click(trigger);
        expect(screen.getByRole('region', { name: 'Tools' })).toBeVisible();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(trigger).toHaveFocus();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(trigger);
        fireEvent.pointerDown(document.body);
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('preserves permission and room gates for staff, camera and building tools', () =>
    {
        const view = render(<DistrictDock isInRoom />);
        fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
        expect(screen.queryByRole('button', { name: /Moderator tools/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Camera' })).toBeNull();
        test.moderator = true; test.camera = true; test.wired = true; test.build = true;
        view.rerender(<DistrictDock isInRoom />);
        const tools = within(screen.getByRole('region', { name: 'Tools' }));
        expect(tools.getByRole('button', { name: /Moderator tools/ })).toBeVisible();
        expect(tools.getByRole('button', { name: 'Camera' })).toBeVisible();
        fireEvent.click(tools.getByRole('button', { name: 'Wired tools' }));
        expect(test.monitor).toHaveBeenCalledOnce();
        view.rerender(<DistrictDock isInRoom={false} />);
        fireEvent.click(screen.getByRole('button', { name: /Tools/ }));
        expect(screen.queryByRole('button', { name: 'Camera' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Build height' })).toBeNull();
        expect(document.getElementById('toolbar-chat-input-container')).toBeNull();
    });
});
