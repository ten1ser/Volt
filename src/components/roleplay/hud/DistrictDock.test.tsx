import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DistrictDock } from './DistrictDock';
import { useGameContextMenu } from '../../../hooks/useGameContextMenu';

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

    it('keeps dock tools hidden until requested, leaving only chat and the phone button visible', () =>
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

    it('opens the Bag menu despite browser-menu suppression and launches the standalone backpack', () =>
    {
        const Fixture = () => { useGameContextMenu(); return <DistrictDock isInRoom />; };
        render(<Fixture />);
        fireEvent.contextMenu(button(/^Phone/));
        expect(test.link).not.toHaveBeenCalled();
        expect(screen.getByRole('menu', { name: 'Dock tools' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Bag' })).toHaveFocus();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Bag' }));
        expect(test.link.mock.calls).toEqual([['phone/hide'], ['backpack/show']]);
        expect(screen.queryByRole('menu')).toBeNull();
        expect(button(/^Phone/)).toHaveAttribute('aria-expanded', 'false');
    });

    it('supports keyboard access and Escape restores focus without opening an app', () =>
    {
        render(<DistrictDock isInRoom />);
        fireEvent.keyDown(button(/^Phone/), { key: 'F10', shiftKey: true });
        expect(screen.getByRole('menuitem', { name: 'Bag' })).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Bag' }), { key: 'Escape' });
        expect(screen.queryByRole('menu')).toBeNull();
        expect(button(/^Phone/)).toHaveFocus();
        expect(test.link).not.toHaveBeenCalled();
    });

    it('dismisses the menu on outside interaction and allows normal phone clicks afterwards', () =>
    {
        render(<DistrictDock isInRoom />);
        fireEvent.contextMenu(button(/^Phone/));
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('menu')).toBeNull();
        fireEvent.click(button(/^Phone/));
        expect(test.link).toHaveBeenCalledExactlyOnceWith('phone/toggle');
    });

    it('offers Bag and an active Radio icon without duplicating Phone', () =>
    {
        render(<DistrictDock isInRoom />);
        fireEvent.contextMenu(button(/^Phone/));
        expect(screen.getAllByRole('menuitem')).toHaveLength(2);
        expect(screen.queryByRole('menuitem', { name: 'Phone' })).toBeNull();
        const radio = screen.getByRole('menuitem', { name: 'Radio' });
        fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Bag' }), { key: 'ArrowRight' });
        expect(radio).toHaveFocus();
        fireEvent.click(radio);
        expect(test.link.mock.calls).toEqual([['phone/hide'], ['radio/show']]);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('shows no radio badge; transmissions are read in room chat', () =>
    {
        render(<DistrictDock isInRoom />);
        expect(button(/^Phone/)).toHaveTextContent('3');
        fireEvent.contextMenu(button(/^Phone/));
        expect(screen.getByRole('menuitem', { name: 'Radio' }).querySelector('.district-badge')).toBeNull();
    });
});
