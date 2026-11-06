import { GetSessionDataManager, RoomObjectType, UserProfileEvent } from '@volt/renderer';
import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AvatarInfoUser } from '../../../api/room/widgets/AvatarInfoUser';
import { GetRoomSession } from '../../../api/volt/session/GetRoomSession';
import { useConnectionState } from '../../../hooks/events/useConnectionState';
import { useMessageEvent } from '../../../hooks/events/useMessageEvent';
import { PlayerCardSlot, usePlayerCardStore } from '../../../state/playerCardStore';
import { InfoStandWidgetUserView } from '../../room/widgets/avatar-info/infostand/InfoStandWidgetUserView';

export const PLAYER_CARD_HOSTS: Record<PlayerCardSlot, string> = { own: 'district-player-card', other: 'district-target-card' };

/** One docked card slot: portals the slot's card into its HUD host and closes it on Escape while focus is inside. */
const PlayerCardSlotView = ({ slot }: { slot: PlayerCardSlot }) =>
{
    const card = usePlayerCardStore(state => state[slot]);
    const close = usePlayerCardStore(state => state.close);
    const setAvatarInfo = usePlayerCardStore(state => state.setAvatarInfo);
    const host = typeof document === 'undefined' ? null : document.getElementById(PLAYER_CARD_HOSTS[slot]);
    const isOpen = !!card;

    useEffect(() =>
    {
        if(!isOpen || !host) return;

        const onKeyDown = (event: KeyboardEvent) =>
        {
            if(event.key !== 'Escape' || event.defaultPrevented) return;

            const active = document.activeElement;

            if(!active || !host.contains(active)) return;

            event.stopPropagation();
            close(slot);
        };

        host.addEventListener('keydown', onKeyDown, true);

        return () => host.removeEventListener('keydown', onKeyDown, true);
    }, [isOpen, close, host, slot]);

    if(!card || !host) return null;

    return createPortal(
        <InfoStandWidgetUserView
            key={`${card.avatarInfo.webID}:${card.version}`}
            avatarInfo={card.avatarInfo}
            setAvatarInfo={value => setAvatarInfo(slot, value)}
            initialTab={card.initialTab}
            onClose={() => close(slot)}
        />,
        host
    );
};

/**
 * The owner of the two docked user cards: your own under your HUD and anyone else's under the target HUD. It stays
 * mounted outside the room widget, so profile links opened from friends, chat or the toolbar work away from a room too.
 * Native profile replies open the card on its Stats tab; each card reads just one 6090 packet for its user.
 */
export const RpProfileView = () =>
{
    const open = usePlayerCardStore(state => state.open);
    const close = usePlayerCardStore(state => state.close);
    const { authenticated } = useConnectionState();

    useEffect(() =>
    {
        if(!authenticated) close();
    }, [authenticated, close]);

    useMessageEvent<UserProfileEvent>(UserProfileEvent, useCallback(event =>
    {
        if(!authenticated) return;

        const parser = event.getParser();

        if(!parser) return;
        // The server can explicitly ask not to raise a profile window; legacy replies have no such field.
        if(parser.openProfileWindow === false) return;

        const userId = parser.id;
        const username = parser.username;
        const figure = parser.figure;

        if(!Number.isSafeInteger(userId) || userId <= 0) return;
        if(typeof username !== 'string' || !username.trim()) return;
        if(typeof figure !== 'string' || !figure.trim()) return;

        const roomUser = GetRoomSession()?.userDataManager?.getUserData(userId);
        const isOwnUser = userId === GetSessionDataManager().userId;
        const info = new AvatarInfoUser(isOwnUser ? AvatarInfoUser.OWN_USER : AvatarInfoUser.PEER);

        info.webID = userId;
        info.name = username;
        info.figure = figure;
        info.motto = typeof parser.motto === 'string' ? parser.motto : '';
        info.userType = RoomObjectType.USER;
        // Only a user actually standing in the current room may carry its room index.
        info.roomIndex = roomUser && roomUser.webID === userId && roomUser.type === RoomObjectType.USER ? roomUser.roomIndex : -1;

        open(info, 'stats', 'profile');
    }, [authenticated, open]));

    if(!authenticated) return null;

    return (
        <>
            <PlayerCardSlotView slot="own" />
            <PlayerCardSlotView slot="other" />
        </>
    );
};
