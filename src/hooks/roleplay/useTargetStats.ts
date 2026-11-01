import type { IRoomUserData } from '@volt/renderer';
import { RoomObjectCategory, RoomObjectType, RpTargetStatsEvent, RpTargetStatsRequestComposer } from '@volt/renderer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { RoomWidgetUpdateRoomObjectEvent } from '../../api/room/events/RoomWidgetUpdateRoomObjectEvent';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';
import { useUiEvent } from '../events/useUiEvent';
import { useRoom } from '../rooms/useRoom';
import { useRoomUserListSnapshot, useUserDataSnapshot } from '../session/useSessionSnapshots';

const MAX_INT32 = 2147483647;
const POLL_MS = 1000;

export type TargetIdentity = { userId: number; name: string; figure: string; sex: string };
export type TargetStats = { health: number; energy: number };

type TargetSelection = { roomId: number; roomIndex: number; userId: number };
type TargetReply = { roomId: number; targetUserId: number; health: number; energy: number };
type PendingRequest = { requestId: number; roomId: number; targetUserId: number };

const isOtherHuman = (user: IRoomUserData, ownUserId: number) =>
    user.type === RoomObjectType.USER && user.webID > 0 && user.webID !== ownUserId;

export const useTargetStats = () =>
{
    const { authenticated } = useConnectionState();
    const { roomSession } = useRoom();
    const { userId: ownUserId } = useUserDataSnapshot();
    const roomUsers = useRoomUserListSnapshot();
    const [selection, setSelection] = useState<TargetSelection | null>(null);
    const [reply, setReply] = useState<TargetReply | null>(null);
    const [lockedTarget, setLockedTarget] = useState<(TargetIdentity & { ownerId: number }) | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const pendingRef = useRef<PendingRequest | null>(null);
    const requestIdRef = useRef(0);

    const roomId = roomSession?.roomId ?? 0;
    const [observedRoom, setObservedRoom] = useState({ roomId, users: roomUsers, ready: true });
    const snapshotReady = observedRoom.roomId === roomId
        ? observedRoom.ready || observedRoom.users !== roomUsers
        : observedRoom.users !== roomUsers;
    if (observedRoom.roomId !== roomId || observedRoom.users !== roomUsers)
        setObservedRoom({ roomId, users: roomUsers, ready: snapshotReady });
    const locked = !!lockedTarget && authenticated && lockedTarget.ownerId === ownUserId;
    if (lockedTarget && !locked)
    {
        setLockedTarget(null);
        setSelection(null);
        setReply(null);
    }

    const liveLockedUser = locked && roomId && snapshotReady
        ? roomUsers.find(user => user.webID === lockedTarget.userId && isOtherHuman(user, ownUserId))
        : undefined;

    const target = useMemo<TargetIdentity | null>(() =>
    {
        if (locked)
        {
            const user = liveLockedUser;
            return user ? { userId: user.webID, name: user.name, figure: user.figure, sex: user.sex }
                : { userId: lockedTarget.userId, name: lockedTarget.name, figure: lockedTarget.figure, sex: lockedTarget.sex };
        }
        if(!authenticated || !selection || selection.roomId !== roomId) return null;

        const user = roomUsers.find((roomUser) => roomUser.roomIndex === selection.roomIndex);
        if(!user || user.webID !== selection.userId || !isOtherHuman(user, ownUserId)) return null;

        return { userId: user.webID, name: user.name, figure: user.figure, sex: user.sex };
    }, [authenticated, selection, roomId, roomUsers, ownUserId, locked, lockedTarget, liveLockedUser]);

    if(selection && !target)
    {
        setSelection(null);
        setReply(null);
    }

    const targetUserId = target?.userId ?? 0;
    const inRoom = !!target && !!roomId && (!locked || !!liveLockedUser);
    if (reply && (!inRoom || reply.roomId !== roomId)) setReply(null);

    useEffect(() =>
    {
        if(!authenticated || !roomId || !targetUserId || !inRoom) return;

        const request = () =>
        {
            requestIdRef.current = requestIdRef.current >= MAX_INT32 ? 1 : requestIdRef.current + 1;
            pendingRef.current = { requestId: requestIdRef.current, roomId, targetUserId };
            SendMessageComposer(new RpTargetStatsRequestComposer(requestIdRef.current, roomId, targetUserId));
        };

        request();
        const timer = window.setInterval(request, POLL_MS);

        return () =>
        {
            window.clearInterval(timer);
            pendingRef.current = null;
        };
    }, [authenticated, roomId, targetUserId, selection, inRoom]);

    const receive = useCallback((event: RpTargetStatsEvent) =>
    {
        const parser = event.getParser();
        const pending = pendingRef.current;

        if(!pending || parser.requestId !== pending.requestId || parser.roomId !== pending.roomId || parser.targetUserId !== pending.targetUserId) return;

        if(!parser.available)
        {
            pendingRef.current = null;
            setReply(null);
            setUnavailable(true);
            if (!locked) setSelection(null);
            return;
        }

        setUnavailable(false);
        setReply({ roomId: parser.roomId, targetUserId: parser.targetUserId, health: parser.health, energy: parser.energy });
    }, [locked]);

    useMessageEvent<RpTargetStatsEvent>(RpTargetStatsEvent, receive);

    const clearTarget = useCallback(() =>
    {
        pendingRef.current = null;
        setReply(null);
        setSelection(null);
        setLockedTarget(null);
        setUnavailable(false);
    }, []);

    const toggleLock = useCallback(() =>
    {
        if (locked)
        {
            if (liveLockedUser) setSelection({ roomId, roomIndex: liveLockedUser.roomIndex, userId: liveLockedUser.webID });
            else clearTarget();
            setLockedTarget(null);
        }
        else if (target) setLockedTarget({ ...target, ownerId: ownUserId });
    }, [locked, liveLockedUser, roomId, clearTarget, target, ownUserId]);

    useUiEvent<RoomWidgetUpdateRoomObjectEvent>(RoomWidgetUpdateRoomObjectEvent.OBJECT_SELECTED, (event) =>
    {
        if (locked) return;
        pendingRef.current = null;
        setReply(null);
        setUnavailable(false);

        const user = event.category === RoomObjectCategory.UNIT ? roomUsers.find((roomUser) => roomUser.roomIndex === event.id) : undefined;

        if(!authenticated || !user || event.roomId !== roomId || !isOtherHuman(user, ownUserId))
        {
            setSelection(null);
            return;
        }

        setSelection({ roomId: event.roomId, roomIndex: user.roomIndex, userId: user.webID });
    });

    useUiEvent<RoomWidgetUpdateRoomObjectEvent>(RoomWidgetUpdateRoomObjectEvent.OBJECT_DESELECTED, (event) =>
    {
        if(locked || !selection || event.category !== RoomObjectCategory.UNIT || event.roomId !== selection.roomId || event.id !== selection.roomIndex) return;

        clearTarget();
    });

    useUiEvent<RoomWidgetUpdateRoomObjectEvent>(RoomWidgetUpdateRoomObjectEvent.USER_REMOVED, (event) =>
    {
        if(locked || !selection || event.roomId !== selection.roomId || event.id !== selection.roomIndex) return;

        clearTarget();
    });

    const stats = inRoom && target && reply && reply.roomId === roomId && reply.targetUserId === target.userId
        ? { health: reply.health, energy: reply.energy }
        : null;

    return { target, stats, clearTarget, locked, toggleLock, unavailable: !inRoom || unavailable };
};
