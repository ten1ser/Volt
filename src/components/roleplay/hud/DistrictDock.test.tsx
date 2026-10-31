import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DistrictDock } from './DistrictDock';

const test = vi.hoisted(() => ({ link: vi.fn(), moderator: false }));
vi.mock('@volt/renderer', () => ({ CreateLinkEvent: test.link }));
vi.mock('../../../api', () => ({ MessengerIconState: { HIDDEN: 0, UNREAD: 2 } }));
vi.mock('../../../api/permissions', () => ({ Permission: { ModerationTool: 'moderator' } }));
vi.mock('../../../hooks', () => ({
    useFriends: () => ({ requests: [] }),
    useInventoryUnseenTracker: () => ({ getFullCount: 3 }),
    useMessenger: () => ({ iconState: 0 }),
    useHasPermission: () => test.moderator,
    useOpenIssueCount: () => 2
}));

const button = (name: RegExp | string) => screen.getByRole('button', { name });

describe('DistrictRP chat bar', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
        test.moderator = false;
    });
    afterEach(cleanup);

    it('holds only the chat input and the phone button; every other tool is a phone app', () =>
    {
        render(<DistrictDock isInRoom />);
        expect(document.querySelectorAll('#toolbar-chat-input-container')).toHaveLength(1);
        expect(screen.getAllByRole('button')).toHaveLength(1);
        expect(button(/^Phone/)).toHaveTextContent('3');
        for (const name of [/Businesses/, /Gang/, /Backpack/, /Rooms/]) expect(screen.queryByRole('button', { name })).toBeNull();
        expect(document.querySelector('.district-vitals')).toBeNull();
    });

    it('keeps only the phone button on the hotel view', () =>
    {
        render(<DistrictDock isInRoom={false} />);
        expect(document.querySelector('.district-command-bar__chat')).toBeNull();
        expect(document.querySelector('.district-bottom')).toHaveClass('is-hotel-view');
        expect(button(/^Phone/)).toBeInTheDocument();
    });

    it('opens the phone', () =>
    {
        render(<DistrictDock isInRoom />);
        fireEvent.click(button(/^Phone/));
        expect(test.link).toHaveBeenLastCalledWith('phone/toggle');
    });

    it('adds open moderation issues to the phone badge for moderators', () =>
    {
        test.moderator = true;
        render(<DistrictDock isInRoom />);
        expect(button(/^Phone/)).toHaveTextContent('5');
    });
});
