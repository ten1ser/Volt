import { SetStateAction } from 'react';
import { AvatarInfoUser } from '../api/room/widgets/AvatarInfoUser';
import { createVoltStore } from './createVoltStore';

export type PlayerCardTab = 'overview' | 'stats';
export type PlayerCardSource = 'profile' | 'room';
// Two docked cards: your own under your HUD, anyone else's under the target HUD.
export type PlayerCardSlot = 'own' | 'other';

export interface PlayerCard
{
    avatarInfo: AvatarInfoUser;
    initialTab: PlayerCardTab;
    source: PlayerCardSource;
    // Bumped on every open so reopening the same user remounts the card on the requested tab.
    version: number;
}

export interface PlayerCardState
{
    own: PlayerCard | null;
    other: PlayerCard | null;
    open: (avatarInfo: AvatarInfoUser, initialTab?: PlayerCardTab, source?: PlayerCardSource) => void;
    /** Closes one slot, or both when no slot is given. */
    close: (slot?: PlayerCardSlot) => void;
    /** Closes only the cards opened from inside the current room. */
    closeRoomCards: () => void;
    setAvatarInfo: (slot: PlayerCardSlot, value: SetStateAction<AvatarInfoUser | null>) => void;
}

export const playerCardSlot = (avatarInfo: AvatarInfoUser): PlayerCardSlot => (avatarInfo.type === AvatarInfoUser.OWN_USER ? 'own' : 'other');

let nextVersion = 0;

export const usePlayerCardStore = createVoltStore<PlayerCardState>()((set) => ({
    own: null,
    other: null,
    open: (avatarInfo, initialTab = 'overview', source = 'room') =>
        set({ [playerCardSlot(avatarInfo)]: { avatarInfo, initialTab, source, version: ++nextVersion } }),
    close: (slot) => set(slot ? { [slot]: null } : { own: null, other: null }),
    closeRoomCards: () => set((state) => ({
        own: state.own?.source === 'room' ? null : state.own,
        other: state.other?.source === 'room' ? null : state.other
    })),
    setAvatarInfo: (slot, value) => set((state) =>
    {
        const card = state[slot];

        if (!card) return {};

        const avatarInfo = typeof value === 'function' ? value(card.avatarInfo) : value;

        return { [slot]: avatarInfo ? { ...card, avatarInfo } : null };
    })
}));
