import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneFriendsApp } from './PhoneFriendsApp';

type Friend = { id: number; name: string; online: boolean; figure: string; motto: string; relationshipStatus: number; followingAllowed: boolean };

const test = vi.hoisted(() => ({
    friends: [] as Friend[], requests: [] as { id: number; name: string; figureString: string }[],
    send: vi.fn(), respond: vi.fn(), relationship: vi.fn(), requestFriend: vi.fn(),
    search: { friends: [] as unknown[], others: [] as unknown[] },
    phone: { hasSim: true }, addContact: vi.fn(), callContact: vi.fn(), locate: vi.fn(),
    locations: {}
}));
vi.mock('../../../hooks/roleplay/useRpPhone', () => ({
    LocationState: { Hidden: 0, InRoom: 1, NotInRoom: 2, Offline: 3 },
    useRpPhone: () => ({ status: test.phone, notice: null, clearNotice: vi.fn(), addContact: test.addContact, callContact: test.callContact, locate: test.locate, locations: test.locations })
}));
vi.mock('@volt/renderer', () => ({
    GetSessionDataManager: () => ({ userId: 1 }),
    HabboSearchComposer: class
    {
        constructor(public query: string)
        {}
    },
    RemoveFriendComposer: class
    {
        public ids: number[];
        constructor(...ids: number[])
        {
            this.ids = ids;
        }
    }
}));
vi.mock('../../../api', () => ({
    MessengerFriend: { RELATIONSHIP_NONE: 0, RELATIONSHIP_HEART: 1, RELATIONSHIP_SMILE: 2, RELATIONSHIP_BOBBA: 3 },
    SendMessageComposer: test.send
}));
vi.mock('../../../hooks', () => ({
    useFriends: () => ({
        friends: test.friends,
        onlineFriends: test.friends.filter(friend => friend.online),
        offlineFriends: test.friends.filter(friend => !friend.online),
        requests: test.requests,
        getFriend: (id: number) => test.friends.find(friend => friend.id === id) ?? null,
        requestResponse: test.respond,
        updateRelationship: test.relationship,
        searchResults: test.search,
        searchValue: 'ma',
        setSearchValue: vi.fn(),
        sentRequests: [],
        requestFriend: test.requestFriend
    })
}));
vi.mock('../../../common/layout/LayoutAvatarImageView', () => ({ LayoutAvatarImageView: () => null }));

const friend = (id: number, name: string, online: boolean): Friend => ({ id, name, online, figure: '', motto: '', relationshipStatus: 0, followingAllowed: true });

describe('Phone Friends app', () =>
{
    beforeEach(() =>
    {
        test.friends = [friend(2, 'Marco', true), friend(3, 'Jules', false)];
        test.requests = [];
        test.search = { friends: [], others: [] };
        [test.send, test.respond, test.relationship, test.requestFriend, test.addContact, test.callContact, test.locate].forEach(fn => fn.mockClear());
        test.phone = { hasSim: true };
        test.locations = {};
    });
    afterEach(cleanup);

    it('shows online friends first and everyone under All, filtered by name', () =>
    {
        render(<PhoneFriendsApp onMessage={vi.fn()} onHome={vi.fn()} />);
        expect(screen.getByText('Marco')).toBeInTheDocument();
        expect(screen.queryByText('Jules')).toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: 'All 2' }));
        expect(screen.getByText('Jules')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox', { name: 'Search friends' }), { target: { value: 'jul' } });
        expect(screen.queryByText('Marco')).toBeNull();
    });

    it('messages a friend from the list', () =>
    {
        const onMessage = vi.fn();
        render(<PhoneFriendsApp onMessage={onMessage} onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Message Marco' }));
        expect(onMessage).toHaveBeenCalledWith(2);
    });

    it('accepts and declines friend requests', () =>
    {
        test.requests = [{ id: 9, name: 'Kim', figureString: '' }];
        render(<PhoneFriendsApp onMessage={vi.fn()} onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Requests1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
        expect(test.respond).toHaveBeenCalledWith(9, true);
        fireEvent.click(screen.getByRole('button', { name: 'Decline Kim' }));
        expect(test.respond).toHaveBeenCalledWith(9, false);
    });

    it('opens a profile with call, live location, relationship and a confirmed remove', () =>
    {
        const view = render(<PhoneFriendsApp onMessage={vi.fn()} onHome={vi.fn()} />);
        fireEvent.click(screen.getByText('Marco'));
        expect(screen.queryByRole('button', { name: 'Go to' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Call' }));
        expect(test.callContact).toHaveBeenCalledWith(2);
        fireEvent.click(screen.getByRole('button', { name: 'Live location' }));
        expect(test.locate).toHaveBeenCalledWith(2);
        test.locations = { 2: { userId: 2, state: 1, roomName: 'Main Street', message: '' } };
        view.rerender(<PhoneFriendsApp onMessage={vi.fn()} onHome={vi.fn()} />);
        expect(screen.getByText('Main Street')).toBeInTheDocument();
        test.locations = { 2: { userId: 2, state: 0, roomName: '', message: 'Marco is not sharing their location.' } };
        view.rerender(<PhoneFriendsApp onMessage={vi.fn()} onHome={vi.fn()} />);
        expect(screen.getByText('Marco is not sharing their location.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: 'Heart' }));
        expect(test.relationship).toHaveBeenCalledWith(test.friends[0], 1);
        fireEvent.click(screen.getByRole('button', { name: 'Remove friend' }));
        expect(test.send).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        expect(test.send).toHaveBeenCalledWith(expect.objectContaining({ ids: [2] }));
    });

    it('adds a contact by phone number and warns without a SIM card', () =>
    {
        render(<PhoneFriendsApp onMessage={vi.fn()} onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Find people' }));
        expect(screen.queryByText(/need a SIM card/)).toBeNull();
        fireEvent.change(screen.getByRole('textbox', { name: 'Add by phone number' }), { target: { value: '+12-345-6x' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add number' }));
        expect(test.addContact).toHaveBeenCalledWith('+12-345-6');
    });

    it('disables calling, messaging and live location without a SIM card', () =>
    {
        test.phone = { hasSim: false };
        render(<PhoneFriendsApp onMessage={vi.fn()} onHome={vi.fn()} />);
        fireEvent.click(screen.getByText('Marco'));
        for (const name of ['Message', 'Call', 'Live location']) expect(screen.getByRole('button', { name })).toBeDisabled();
        expect(screen.getByText('Needs a SIM card.')).toBeInTheDocument();
    });

    it('warns that contacts need a SIM card', () =>
    {
        test.phone = { hasSim: false };
        render(<PhoneFriendsApp onMessage={vi.fn()} onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Find people' }));
        expect(screen.getByText(/need a SIM card to add contacts/)).toBeInTheDocument();
    });

    it('searches the hotel and sends a friend request', () =>
    {
        test.search = { friends: [], others: [{ avatarId: 5, avatarName: 'Mara', avatarFigure: '', isAvatarOnline: true }] };
        render(<PhoneFriendsApp onMessage={vi.fn()} onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Find people' }));
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));
        expect(test.send).toHaveBeenCalledWith(expect.objectContaining({ query: 'ma' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        expect(test.requestFriend).toHaveBeenCalledWith(5, 'Mara');
    });
});
