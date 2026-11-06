import { beforeEach, describe, expect, it } from 'vitest';
import { AvatarInfoUser } from '../api/room/widgets/AvatarInfoUser';
import { usePlayerCardStore } from './playerCardStore';

const user = (webID: number, name = 'Ada', type = AvatarInfoUser.PEER) =>
{
    const info = new AvatarInfoUser(type);

    info.webID = webID;
    info.name = name;
    info.figure = 'hd-180-1';

    return info;
};

const own = (webID = 5) => user(webID, 'Me', AvatarInfoUser.OWN_USER);

describe('playerCardStore', () =>
{
    beforeEach(() => usePlayerCardStore.getState().close());

    it('opens a peer in the other slot with the requested tab and source', () =>
    {
        const info = user(7);

        usePlayerCardStore.getState().open(info, 'stats', 'profile');

        expect(usePlayerCardStore.getState().other).toMatchObject({ avatarInfo: info, initialTab: 'stats', source: 'profile' });
        expect(usePlayerCardStore.getState().own).toBeNull();
    });

    it('keeps your own card and a peer card open together', () =>
    {
        const me = own();
        const peer = user(7);

        usePlayerCardStore.getState().open(me);
        usePlayerCardStore.getState().open(peer);

        expect(usePlayerCardStore.getState().own).toMatchObject({ avatarInfo: me, initialTab: 'overview', source: 'room' });
        expect(usePlayerCardStore.getState().other).toMatchObject({ avatarInfo: peer, initialTab: 'overview', source: 'room' });
    });

    it('gives every open a new version so the same user remounts', () =>
    {
        usePlayerCardStore.getState().open(user(7));
        const first = usePlayerCardStore.getState().other.version;

        usePlayerCardStore.getState().open(user(7));

        expect(usePlayerCardStore.getState().other.version).toBeGreaterThan(first);
    });

    it('applies the React updater to one slot without losing its tab or source', () =>
    {
        const info = user(7);

        usePlayerCardStore.getState().open(own());
        usePlayerCardStore.getState().open(info, 'stats', 'profile');
        usePlayerCardStore.getState().setAvatarInfo('other', (previous) =>
        {
            previous.motto = 'edited';

            return previous;
        });

        expect(usePlayerCardStore.getState().other).toMatchObject({ avatarInfo: info, initialTab: 'stats', source: 'profile' });
        expect(usePlayerCardStore.getState().other.avatarInfo.motto).toBe('edited');

        usePlayerCardStore.getState().setAvatarInfo('other', null);

        expect(usePlayerCardStore.getState().other).toBeNull();
        expect(usePlayerCardStore.getState().own).not.toBeNull();
    });

    it('closes one slot, room cards only, or everything', () =>
    {
        usePlayerCardStore.getState().open(own(), 'overview', 'room');
        usePlayerCardStore.getState().open(user(7), 'stats', 'profile');

        usePlayerCardStore.getState().closeRoomCards();
        expect(usePlayerCardStore.getState().own).toBeNull();
        expect(usePlayerCardStore.getState().other).not.toBeNull();

        usePlayerCardStore.getState().open(own(), 'overview', 'room');
        usePlayerCardStore.getState().close('own');
        expect(usePlayerCardStore.getState().own).toBeNull();
        expect(usePlayerCardStore.getState().other).not.toBeNull();

        usePlayerCardStore.getState().close();
        expect(usePlayerCardStore.getState()).toMatchObject({ own: null, other: null });
    });
});
