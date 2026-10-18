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
    const pendingRef = useRef<PendingRequest | null>(null);
    const requestIdRef = useRef(0);

    const roomId = roomSession?.roomId ?? 0;

    const target = useMemo<TargetIdentity | null>(() =>
    {
        if(!authenticated || !selection || selection.roomId !== roomId) return null;

        const user = roomUsers.find((roomUser) => roomUser.roomIndex === selection.roomIndex);
        if(!user || user.webID !== selection.userId || !isOtherHuman(user, ownUserId)) return null;

        return { userId: user.webID, name: user.name, figure: user.figure, sex: user.sex };
    }, [authenticated, selection, roomId, roomUsers, ownUserId]);

    if(selection && !target)
    {
        setSelection(null);
        setReply(null);
    }

    const targetUserId = target?.userId ?? 0;

    useEffect(() =>
    {
        if(!authenticated || !roomId || !targetUserId) return;

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
    }, [authenticated, roomId, targetUserId, selection]);

    const receive = useCallback((event: RpTargetStatsEvent) =>
    {
        const parser = event.getParser();
        const pending = pendingRef.current;

        if(!pending || parser.requestId !== pending.requestId || parser.roomId !== pending.roomId || parser.targetUserId !== pending.targetUserId) return;

        if(!parser.available)
        {
            pendingRef.current = null;
            setReply(null);
            setSelection(null);
            return;
        }

        setReply({ roomId: parser.roomId, targetUserId: parser.targetUserId, health: parser.health, energy: parser.energy });
    }, []);

    useMessageEvent<RpTargetStatsEvent>(RpTargetStatsEvent, receive);

    const clearTarget = useCallback(() =>
    {
        pendingRef.current = null;
        setReply(null);
        setSelection(null);
    }, []);

    useUiEvent<RoomWidgetUpdateRoomObjectEvent>(RoomWidgetUpdateRoomObjectEvent.OBJECT_SELECTED, (event) =>
    {
        pendingRef.current = null;
        setReply(null);

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
        if(!selection || event.category !== RoomObjectCategory.UNIT || event.roomId !== selection.roomId || event.id !== selection.roomIndex) return;

        clearTarget();
    });

    useUiEvent<RoomWidgetUpdateRoomObjectEvent>(RoomWidgetUpdateRoomObjectEvent.USER_REMOVED, (event) =>
    {
        if(!selection || event.roomId !== selection.roomId || event.id !== selection.roomIndex) return;

        clearTarget();
    });

    const stats = target && reply && reply.roomId === roomId && reply.targetUserId === target.userId
        ? { health: reply.health, energy: reply.energy }
        : null;

    return { target, stats, clearTarget };
};
