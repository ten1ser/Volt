import { createVoltStore } from '../../../../state/createVoltStore';

interface RoomToolsMenuState
{
    open: boolean;
    setOpen: (open: boolean) => void;
    toggle: () => void;
}

// The room tools open as a menu under the room name chip in the HUD; both read this flag.
export const useRoomToolsMenuStore = createVoltStore<RoomToolsMenuState>()(set => ({
    open: false,
    setOpen: open => set({ open }),
    toggle: () => set(state => ({ open: !state.open }))
}));
