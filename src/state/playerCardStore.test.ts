import { beforeEach, describe, expect, it } from 'vitest';
import { AvatarInfoUser } from '../api/room/widgets/AvatarInfoUser';
import { usePlayerCardStore } from './playerCardStore';

const user = (webID: number, name = 'Ada') =>
{
    const info = new AvatarInfoUser(AvatarInfoUser.PEER);

    info.webID = webID;
    info.name = name;
    info.figure = 'hd-180-1';

    return info;
};

describe('playerCardStore', () =>
{
    beforeEach(() => usePlayerCardStore.getState().close());

    it('opens one card with the requested tab and source', () =>
    {
        const info = user(7);

        usePlayerCardStore.getState().open(info, 'stats', 'profile');

        expect(usePlayerCardStore.getState()).toMatchObject({ avatarInfo: info, initialTab: 'stats', source: 'profile' });
    });

    it('defaults a room card to Overview', () =>
    {
        const info = user(7);

        usePlayerCardStore.getState().open(info);

        expect(usePlayerCardStore.getState()).toMatchObject({ avatarInfo: info, initialTab: 'overview', source: 'room' });
    });

    it('applies the React updater without losing the requested tab or source', () =>
    {
        const info = user(7);

        usePlayerCardStore.getState().open(info, 'stats', 'profile');
        usePlayerCardStore.getState().setAvatarInfo((previous) =>
        {
            previous.motto = 'edited';

            return previous;
        });

        expect(usePlayerCardStore.getState()).toMatchObject({ avatarInfo: info, initialTab: 'stats', source: 'profile' });
        expect(usePlayerCardStore.getState().avatarInfo.motto).toBe('edited');

        usePlayerCardStore.getState().setAvatarInfo(null);

        expect(usePlayerCardStore.getState()).toMatchObject({ avatarInfo: null, initialTab: 'overview', source: null });
    });

    it('closes and resets everything', () =>
    {
        usePlayerCardStore.getState().open(user(7), 'stats', 'room');
        usePlayerCardStore.getState().close();

        expect(usePlayerCardStore.getState()).toMatchObject({ avatarInfo: null, initialTab: 'overview', source: null });
    });
});
