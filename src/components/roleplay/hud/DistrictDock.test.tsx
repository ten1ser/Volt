import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const menuButton = () => screen.getByRole('button', { name: /^District menu/ });
const openMenu = () => fireEvent.click(menuButton());
const popup = () => document.getElementById('district-popup');

describe('DistrictRP district menu', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
        test.moderator = false; test.camera = false; test.wired = false; test.build = false;
    });
    afterEach(cleanup);

    it('starts closed with one aggregate unread badge and single chat/friendbar portals', () =>
    {
        render(<DistrictDock isInRoom />);
        const menu = screen.getByRole('button', { name: 'District menu, 3 unread' });
        expect(menu).toHaveAttribute('aria-expanded', 'false');
        expect(menu).toHaveAttribute('aria-controls', 'district-popup');
        expect(popup()).toHaveAttribute('hidden');
        expect(within(menu).getByText('3')).toBeInTheDocument();
        expect(document.querySelectorAll('#toolbar-chat-input-container')).toHaveLength(1);
        expect(document.querySelectorAll('#toolbar-friend-bar-container-desktop')).toHaveLength(1);
        expect(screen.queryByRole('button', { name: 'Rooms' })).toBeNull();
    });

    it('opens from D and routes main actions to existing features', async () =>
    {
        render(<DistrictDock isInRoom />);
        openMenu();
        expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
        expect(popup()).not.toHaveAttribute('hidden');
        await waitFor(() => expect(screen.getByRole('button', { name: 'City' })).toHaveFocus());
        fireEvent.click(screen.getByRole('button', { name: 'Rooms' }));
        expect(test.link).toHaveBeenLastCalledWith('navigator/toggle');
        expect(popup()).toHaveAttribute('hidden');
        openMenu();
        fireEvent.click(screen.getByRole('button', { name: /Inventory/ }));
        expect(test.link).toHaveBeenLastCalledWith('inventory/toggle');
        openMenu();
        fireEvent.click(screen.getByRole('button', { name: 'City' }));
        expect(test.visit).toHaveBeenCalledOnce();
        openMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Businesses' }));
        expect(test.link).toHaveBeenLastCalledWith('businesses/toggle');
    });

    it('leaves focus on a feature opened by a menu action instead of stealing it back to D', async () =>
    {
        const external = document.createElement('input');
        document.body.appendChild(external);
        test.link.mockImplementationOnce(() => external.focus());
        render(<DistrictDock isInRoom />);
        openMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Rooms' }));
        await act(async () =>
        {
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        });
        expect(external).toHaveFocus();
        external.remove();
    });

    it('cancels pending open focus when the menu closes before the frame', async () =>
    {
        const external = document.createElement('input');
        document.body.appendChild(external);
        external.focus();
        render(<DistrictDock isInRoom />);
        openMenu();
        fireEvent.click(menuButton());
        await act(async () =>
        {
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        });
        expect(external).toHaveFocus();
        expect(screen.queryByRole('button', { name: 'City' })).toBeNull();
        external.remove();
    });

    it('hides the unread badge while open and keeps the count in the menu name', () =>
    {
        render(<DistrictDock isInRoom />);
        openMenu();
        const menu = screen.getByRole('button', { name: 'District menu, 3 unread' });
        expect(menu.querySelector('.district-badge')).toBeNull();
    });

    it('keeps Character and Progress out of the menu and Tools subpanel', () =>
    {
        render(<DistrictDock isInRoom />);
        openMenu();
        expect(screen.queryByRole('button', { name: 'Character' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Progress/ })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
        expect(screen.queryByRole('button', { name: /Progress/ })).toBeNull();
        expect(document.getElementById('district-character')).toBeNull();
        expect(document.getElementById('district-progress')).toBeNull();
    });

    it('closes the whole menu on Escape with focus restored, and on outside pointer', () =>
    {
        render(<DistrictDock isInRoom />);
        openMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
        expect(screen.getByRole('region', { name: 'Tools' })).toBeVisible();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(popup()).toHaveAttribute('hidden');
        expect(menuButton()).toHaveFocus();
        expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
        openMenu();
        fireEvent.pointerDown(document.body);
        expect(popup()).toHaveAttribute('hidden');
    });

    it('opens Social and Tools subpanels and returns with Back to the initiating button', async () =>
    {
        render(<DistrictDock isInRoom />);
        openMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Social' }));
        const social = screen.getByRole('region', { name: 'Social' });
        expect(within(social).getByRole('button', { name: 'Friends' })).toBeVisible();
        expect(document.querySelectorAll('#toolbar-friend-bar-container-desktop')).toHaveLength(1);
        fireEvent.click(within(social).getByRole('button', { name: 'Back to District menu' }));
        expect(screen.queryByRole('region', { name: 'Social' })).toBeNull();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Social' })).toHaveFocus());
        expect(screen.getByRole('button', { name: 'City' })).not.toHaveFocus();

        fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
        const tools = screen.getByRole('region', { name: 'Tools' });
        expect(within(tools).getByRole('button', { name: 'Settings' })).toBeVisible();
        expect(within(tools).getByRole('button', { name: 'Help' })).toBeVisible();
        fireEvent.click(within(tools).getByRole('button', { name: 'Back to District menu' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Tools' })).toHaveFocus());
    });

    it('preserves permission and room gates for staff, camera and building tools', () =>
    {
        const view = render(<DistrictDock isInRoom />);
        openMenu();
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
        expect(screen.queryByRole('button', { name: 'Camera' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Build height' })).toBeNull();
        expect(document.getElementById('toolbar-chat-input-container')).toBeNull();
    });
});
