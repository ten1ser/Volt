import { SetStateAction } from 'react';
import { AvatarInfoUser } from '../api/room/widgets/AvatarInfoUser';
import { createVoltStore } from './createVoltStore';

export type PlayerCardTab = 'overview' | 'stats';
export type PlayerCardSource = 'profile' | 'room';

export interface PlayerCardState
{
    avatarInfo: AvatarInfoUser | null;
    initialTab: PlayerCardTab;
    source: PlayerCardSource | null;
    open: (avatarInfo: AvatarInfoUser, initialTab?: PlayerCardTab, source?: PlayerCardSource) => void;
    close: () => void;
    setAvatarInfo: (value: SetStateAction<AvatarInfoUser | null>) => void;
}

export const usePlayerCardStore = createVoltStore<PlayerCardState>()((set) => ({
    avatarInfo: null,
    initialTab: 'overview',
    source: null,
    open: (avatarInfo, initialTab = 'overview', source = 'room') => set({ avatarInfo, initialTab, source }),
    close: () => set({ avatarInfo: null, initialTab: 'overview', source: null }),
    setAvatarInfo: (value) => set((state) =>
    {
        const avatarInfo = typeof value === 'function' ? value(state.avatarInfo) : value;

        return avatarInfo ? { avatarInfo } : { avatarInfo: null, initialTab: 'overview', source: null };
    })
}));
