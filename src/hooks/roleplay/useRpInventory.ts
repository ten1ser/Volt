import type { RpInventorySlot } from '@volt/renderer';
import { RoomObjectCategory, RoomObjectType, RpInventoryEvent, RpInventoryRequestComposer } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomWidgetUpdateRoomObjectEvent } from '../../api/room/events/RoomWidgetUpdateRoomObjectEvent';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';
import { useUiEvent } from '../events/useUiEvent';
import { useRoomUserListSnapshot, useUserDataSnapshot } from '../session/useSessionSnapshots';

// Wire actions of packet 6080.
export const InventoryAction = { Read: 0, Move: 1, Use: 2, Drop: 3, Destroy: 4 } as const;

let nextRequestId = 0;
const allocateRequestId = () =>
{
    nextRequestId = nextRequestId % 2147483647 + 1;
    return nextRequestId;
};

export type PendingDestroy = { slot: number; message: string };

/**
 * The player's backpack (packet 6080). The server answers every request with the full 10 slots and pushes
 * them (requestId 0) whenever they change elsewhere, so the slots always reflect the last server message.
 */
export const useRpInventory = (open: boolean) =>
{
    const { authenticated } = useConnectionState();
    const [slots, setSlots] = useState<readonly RpInventorySlot[]>([]);
    const [notice, setNotice] = useState('');
    const [pendingDestroy, setPendingDestroy] = useState<PendingDestroy | null>(null);
    const lastDropSlot = useRef(0);

    const send = useCallback((action: number, fromSlot = 0, toSlot = 0, targetUserId = 0) =>
    {
        if(!authenticated) return;
        if(action === InventoryAction.Drop) lastDropSlot.current = fromSlot;
        try
        {
            SendMessageComposer(new RpInventoryRequestComposer(allocateRequestId(), action, fromSlot, toSlot, targetUserId));
        }
        catch
        {
            setNotice('That action could not be sent.');
        }
    }, [authenticated]);

    useMessageEvent<RpInventoryEvent>(RpInventoryEvent, useCallback(event =>
    {
        const parser = event.getParser();
        if(parser.slots.length !== 10) return;
        setSlots(parser.slots);
        if(parser.result === 2) setPendingDestroy({ slot: lastDropSlot.current, message: parser.message });
        else if(parser.message) setNotice(parser.message);
    }, []));

    useEffect(() =>
    {
        if(!open || !authenticated) return;
        // The read sets no state; a failed read just leaves the last slots shown.
        try
        {
            SendMessageComposer(new RpInventoryRequestComposer(allocateRequestId(), InventoryAction.Read, 0, 0, 0));
        }
        catch
        {}
    }, [open, authenticated]);

    return {
        slots: authenticated ? slots : [],
        notice,
        clearNotice: () => setNotice(''),
        pendingDestroy,
        move: (fromSlot: number, toSlot: number) => send(InventoryAction.Move, fromSlot, toSlot),
        use: (slot: number) => send(InventoryAction.Use, slot),
        drop: (slot: number, targetUserId: number) => send(InventoryAction.Drop, slot, 0, targetUserId),
        confirmDestroy: () =>
        {
            if(pendingDestroy) send(InventoryAction.Destroy, pendingDestroy.slot);
            setPendingDestroy(null);
        },
        cancelDestroy: () => setPendingDestroy(null),
        authenticated
    };
};

/** The other player currently selected in the room (0 for none); Drop hands items to them. */
export const useSelectedUserId = () =>
{
    const roomUsers = useRoomUserListSnapshot();
    const { userId: ownUserId } = useUserDataSnapshot();
    const [roomIndex, setRoomIndex] = useState<number | null>(null);

    useUiEvent<RoomWidgetUpdateRoomObjectEvent>(RoomWidgetUpdateRoomObjectEvent.OBJECT_SELECTED, event =>
        setRoomIndex(event.category === RoomObjectCategory.UNIT ? event.id : null));
    useUiEvent<RoomWidgetUpdateRoomObjectEvent>(RoomWidgetUpdateRoomObjectEvent.OBJECT_DESELECTED, () => setRoomIndex(null));

    const user = roomIndex === null ? undefined : roomUsers.find(roomUser => roomUser.roomIndex === roomIndex);
    return user && user.type === RoomObjectType.USER && user.webID > 0 && user.webID !== ownUserId ? user.webID : 0;
};
