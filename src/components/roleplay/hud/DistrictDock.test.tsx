import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DistrictDock } from './DistrictDock';

const test = vi.hoisted(() => ({ link: vi.fn(), profile: vi.fn(), visit: vi.fn(), moderator: false, camera: false, wired: false, build: false, monitor: vi.fn(), toggleBuild: vi.fn(), credits: 50200 }));
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
    useFriends: () => ({ requests: [] }),
    useInventoryUnseenTracker: () => ({ getFullCount: 3 }),
    useMessenger: () => ({ iconState: 0 }),
    useHasPermission: () => test.moderator,
    useOpenIssueCount: () => 2,
    useWiredTools: () => ({ showToolbarButton: test.wired, openMonitor: test.monitor }),
    useBuildHeight: () => ({ available: test.build, toggle: test.toggleBuild }),
    usePurse: () => ({ purse: { credits: test.credits } })
}));
vi.mock('../../../state/perkAllowancesStore', () => ({ usePerkAllowed: (perk: string) => perk === 'camera' && test.camera }));
vi.mock('../stats/StatsHud', () => ({ StatsHud: () => <section aria-label="Your stats" /> }));
vi.mock('../stats/TargetHud', () => ({ TargetHud: () => <section aria-label="Target stats" /> }));

const button = (name: RegExp | string) => screen.getByRole('button', { name });
const panel = (name: string) => screen.getByRole('region', { name });

describe('DistrictRP command bar', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
        test.moderator = false; test.camera = false; test.wired = false; test.build = false; test.credits = 50200;
    });
    afterEach(cleanup);

    it('renders one bar with the citizen card, native RP Coins, icons and single portal hosts', () =>
    {
        render(<DistrictDock isInRoom />);
        const bar = document.querySelector('.district-command-bar');
        expect(bar).not.toBeNull();
        expect(within(bar as HTMLElement).getByLabelText('Your stats')).toBeInTheDocument();
        expect(within(bar as HTMLElement).getByLabelText('Target stats')).toBeInTheDocument();
        expect(within(bar as HTMLElement).getByText('50,200')).toBeInTheDocument();
        expect(within(bar as HTMLElement).getByText('RP Coins')).toBeInTheDocument();
        for(const name of ['Businesses', 'Shop', 'Rooms']) expect(button(name)).toBeInTheDocument();
        expect(button(/^Inventory/)).toHaveTextContent('3');
        expect(button(/^Social/)).toBeInTheDocument();
        expect(button(/^More/)).toBeInTheDocument();
        expect(document.querySelectorAll('#toolbar-chat-input-container')).toHaveLength(1);
        expect(document.querySelectorAll('#toolbar-friend-bar-container-desktop')).toHaveLength(1);
        expect(screen.queryByRole('button', { name: /District menu/ })).toBeNull();
        expect(document.querySelector('.district-menu-button')).toBeNull();
    });

    it('routes every always-visible icon to its existing feature', () =>
    {
        render(<DistrictDock isInRoom />);
        fireEvent.click(button('Businesses'));
        expect(test.link).toHaveBeenLastCalledWith('businesses/toggle');
        fireEvent.click(button(/^Inventory/));
        expect(test.link).toHaveBeenLastCalledWith('inventory/toggle');
        fireEvent.click(button('Shop'));
        expect(test.link).toHaveBeenLastCalledWith('catalog/toggle/normal');
        fireEvent.click(button('Rooms'));
        expect(test.link).toHaveBeenLastCalledWith('navigator/toggle');
    });

    it('opens Social with friends actions and the friendbar portal, and runs an action', async () =>
    {
        render(<DistrictDock isInRoom />);
        const social = button(/^Social/);
        fireEvent.click(social);
        expect(social).toHaveAttribute('aria-expanded', 'true');
        expect(social).toHaveAttribute('aria-controls', 'district-social');
        const region = panel('Social');
        expect(within(region).getByRole('button', { name: 'Friends' })).toBeVisible();
        expect(within(region).getByRole('button', { name: 'Find people' })).toBeVisible();
        expect(document.querySelectorAll('#toolbar-friend-bar-container-desktop')).toHaveLength(1);
        await waitFor(() => expect(within(region).getByRole('button', { name: 'Friends' })).toHaveFocus());
        fireEvent.click(within(region).getByRole('button', { name: 'Find people' }));
        expect(test.link).toHaveBeenLastCalledWith('friends/search');
        expect(screen.queryByRole('region', { name: 'Social' })).toBeNull();
    });

    it('opens More with the City action and the existing tools list', () =>
    {
        render(<DistrictDock isInRoom />);
        fireEvent.click(button(/^More/));
        expect(button(/^More/)).toHaveAttribute('aria-controls', 'district-more');
        fireEvent.click(within(panel('More')).getByRole('button', { name: 'City' }));
        expect(test.visit).toHaveBeenCalledOnce();
        fireEvent.click(button(/^More/));
        fireEvent.click(within(panel('More')).getByRole('button', { name: 'Settings' }));
        expect(test.link).toHaveBeenLastCalledWith('user-settings/show/other');
        expect(screen.queryByRole('region', { name: 'More' })).toBeNull();
        expect(button(/^More/)).toHaveFocus();
    });

    it('closes on Escape with focus returned to the triggering icon', async () =>
    {
        render(<DistrictDock isInRoom />);
        const social = button(/^Social/);
        fireEvent.click(social);
        await act(async () =>
        {
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('region', { name: 'Social' })).toBeNull();
        expect(social).toHaveFocus();
        expect(social).toHaveAttribute('aria-expanded', 'false');

        const more = button(/^More/);
        fireEvent.click(more);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('region', { name: 'More' })).toBeNull();
        expect(more).toHaveFocus();
    });

    it('closes an open popup on an outside pointer without losing the bar', () =>
    {
        render(<DistrictDock isInRoom />);
        fireEvent.click(button(/^More/));
        expect(panel('More')).toBeVisible();
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('region', { name: 'More' })).toBeNull();
        expect(button(/^More/)).toBeInTheDocument();
    });

    it('keeps Character and Progress out of the bar and the More popup', () =>
    {
        render(<DistrictDock isInRoom />);
        expect(screen.queryByRole('button', { name: 'Character' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Progress/ })).toBeNull();
        fireEvent.click(button(/^More/));
        expect(screen.queryByRole('button', { name: /Progress/ })).toBeNull();
        expect(document.getElementById('district-character')).toBeNull();
        expect(document.getElementById('district-progress')).toBeNull();
    });

    it('preserves permission and room gates for staff, camera and building tools', () =>
    {
        const view = render(<DistrictDock isInRoom />);
        fireEvent.click(button(/^More/));
        expect(screen.queryByRole('button', { name: /Moderator tools/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Camera' })).toBeNull();
        test.moderator = true; test.camera = true; test.wired = true; test.build = true;
        view.rerender(<DistrictDock isInRoom />);
        const more = within(panel('More'));
        expect(more.getByRole('button', { name: /Moderator tools/ })).toBeVisible();
        expect(more.getByRole('button', { name: 'Camera' })).toBeVisible();
        fireEvent.click(more.getByRole('button', { name: 'Wired tools' }));
        expect(test.monitor).toHaveBeenCalledOnce();
        expect(button(/^More/)).toHaveTextContent('2');
        view.rerender(<DistrictDock isInRoom={false} />);
        expect(document.getElementById('toolbar-chat-input-container')).toBeNull();
        fireEvent.click(button(/^More/));
        const outsideRoom = within(panel('More'));
        expect(outsideRoom.queryByRole('button', { name: 'Camera' })).toBeNull();
        expect(outsideRoom.queryByRole('button', { name: 'Build height' })).toBeNull();
        expect(outsideRoom.queryByRole('button', { name: 'City' })).toBeNull();
        expect(outsideRoom.getByRole('button', { name: 'Home' })).toBeVisible();
    });
});
