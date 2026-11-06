import { GetSessionDataManager, RoomObjectType, UserProfileEvent } from '@volt/renderer';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AvatarInfoUser } from '../../../api/room/widgets/AvatarInfoUser';
import { GetRoomSession } from '../../../api/volt/session/GetRoomSession';
import { useConnectionState } from '../../../hooks/events/useConnectionState';
import { useMessageEvent } from '../../../hooks/events/useMessageEvent';
import { usePlayerCardStore } from '../../../state/playerCardStore';
import { InfoStandWidgetUserView } from '../../room/widgets/avatar-info/infostand/InfoStandWidgetUserView';

/**
 * The single owner of the docked user card. It stays mounted outside the room widget, so profile links opened from
 * friends, chat or the toolbar work away from a room too. Native profile replies open the card on its Stats tab; the
 * card reads just one 6090 packet for that user.
 */
export const RpProfileView = () =>
{
    const avatarInfo = usePlayerCardStore(state => state.avatarInfo);
    const initialTab = usePlayerCardStore(state => state.initialTab);
    const open = usePlayerCardStore(state => state.open);
    const close = usePlayerCardStore(state => state.close);
    const setAvatarInfo = usePlayerCardStore(state => state.setAvatarInfo);
    const [profileOpenVersion, setProfileOpenVersion] = useState(0);
    const { authenticated } = useConnectionState();
    const host = typeof document === 'undefined' ? null : document.getElementById('district-player-card');

    useEffect(() =>
    {
        if(!authenticated) close();
    }, [authenticated, close]);

    useEffect(() =>
    {
        if(!avatarInfo || !host) return;

        const onKeyDown = (event: KeyboardEvent) =>
        {
            if(event.key !== 'Escape' || event.defaultPrevented) return;

            const active = document.activeElement;

            if(!active || !host.contains(active)) return;

            event.stopPropagation();
            close();
        };

        host.addEventListener('keydown', onKeyDown, true);

        return () => host.removeEventListener('keydown', onKeyDown, true);
    }, [avatarInfo, close, host]);

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

        setProfileOpenVersion(version => version + 1);
        open(info, 'stats', 'profile');
    }, [authenticated, open]));

    if(!authenticated || !avatarInfo || !host) return null;

    return createPortal(
        <InfoStandWidgetUserView
            key={`${avatarInfo.webID}:${profileOpenVersion}`}
            avatarInfo={avatarInfo}
            setAvatarInfo={setAvatarInfo}
            initialTab={initialTab}
            onClose={close}
        />,
        host
    );
};
