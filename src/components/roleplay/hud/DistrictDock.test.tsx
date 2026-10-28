import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DistrictDock } from './DistrictDock';

const test = vi.hoisted(() => ({ link: vi.fn(), moderator: false }));
vi.mock('@volt/renderer', () => ({ CreateLinkEvent: test.link }));
vi.mock('../../../api', () => ({
    localizeWithFallback: (_key: string, fallback: string) => fallback,
    MessengerIconState: { HIDDEN: 0, UNREAD: 2 }
}));
vi.mock('../../../api/permissions', () => ({ Permission: { ModerationTool: 'moderator' } }));
vi.mock('../../../hooks', () => ({
    useFriends: () => ({ requests: [] }),
    useInventoryUnseenTracker: () => ({ getFullCount: 3 }),
    useMessenger: () => ({ iconState: 0 }),
    useHasPermission: () => test.moderator,
    useOpenIssueCount: () => 2
}));
vi.mock('../stats/StatsHud', () => ({ StatsHud: () => <section aria-label="Your stats" /> }));
vi.mock('../stats/TargetHud', () => ({ TargetHud: () => <section aria-label="Target stats" /> }));

const button = (name: RegExp | string) => screen.getByRole('button', { name });

describe('DistrictRP command bar', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
        test.moderator = false;
    });
    afterEach(cleanup);

    it('stacks the target above the own card beside a dock with chat and the four icons', () =>
    {
        render(<DistrictDock isInRoom />);
        const bar = document.querySelector('.district-command-bar');
        const vitals = document.querySelector('.district-vitals');
        expect([...vitals.children].map(card => card.getAttribute('aria-label'))).toEqual(['Target stats', 'Your stats']);
        expect(bar.contains(vitals)).toBe(false);
        const actions = screen.getByRole('group', { name: 'District actions' });
        for (const name of ['Businesses', 'Backpack', 'Rooms']) expect(actions.contains(button(name))).toBe(true);
        expect(button(/^Phone/)).toHaveTextContent('3');
        for (const name of [/^Inventory/, /^Shop/, /^Social/, /^More/]) expect(screen.queryByRole('button', { name })).toBeNull();
        expect(document.querySelectorAll('#toolbar-chat-input-container')).toHaveLength(1);
        expect(document.getElementById('district-popup')).toBeNull();
        expect(bar.querySelectorAll('.district-command-bar__divider')).toHaveLength(2);
    });

    it('drops the chat section and its divider outside a room', () =>
    {
        render(<DistrictDock isInRoom={false} />);
        const bar = document.querySelector('.district-command-bar');
        expect(bar.querySelector('.district-command-bar__chat')).toBeNull();
        expect(bar.querySelectorAll('.district-command-bar__divider')).toHaveLength(1);
    });

    it('routes every icon to its feature', () =>
    {
        render(<DistrictDock isInRoom />);
        fireEvent.click(button('Businesses'));
        expect(test.link).toHaveBeenLastCalledWith('businesses/toggle');
        fireEvent.click(button('Backpack'));
        expect(test.link).toHaveBeenLastCalledWith('backpack/toggle');
        fireEvent.click(button(/^Phone/));
        expect(test.link).toHaveBeenLastCalledWith('phone/toggle');
        fireEvent.click(button('Rooms'));
        expect(test.link).toHaveBeenLastCalledWith('navigator/toggle');
    });

    it('adds open moderation issues to the phone badge for moderators', () =>
    {
        test.moderator = true;
        render(<DistrictDock isInRoom />);
        expect(button(/^Phone/)).toHaveTextContent('5');
    });
});
