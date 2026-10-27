import {
    UserSettingsCameraFollowComposer,
    UserSettingsEvent,
    UserSettingsOnlineIndicatorComposer,
    UserSettingsRoomInvitesComposer,
    UserSettingsSoundComposer,
    VoltSettingsEvent
} from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSharedHook, useSharedHook } from '@/state/useSharedHook';
import { DispatchMainEvent, DispatchUiEvent, SendMessageComposer } from '../api';
import { useMessageEvent } from './events';

export type UserSettingsAction = 'room_invites' | 'camera_follow' | 'system_volume' | 'furni_volume' | 'trax_volume';

const clampVolume = (value: number) => Math.max(0, Math.min(100, Number(value)));

/** The player's hotel settings, shared by the settings windows and the phone so both always show the same values. */
const useUserSettingsState = () =>
{
    const [userSettings, setUserSettings] = useState<VoltSettingsEvent>(null);
    const [onlineIndicatorPreference, setOnlineIndicatorPreference] = useState<number>(null);
    const userSettingsRef = useRef<VoltSettingsEvent>(null);

    const publish = useCallback((next: VoltSettingsEvent) =>
    {
        userSettingsRef.current = next;
        setUserSettings(next);
    }, []);

    useMessageEvent<UserSettingsEvent>(UserSettingsEvent, (event) =>
    {
        const parser = event.getParser();
        const settingsEvent = new VoltSettingsEvent();

        settingsEvent.volumeSystem = parser.volumeSystem;
        settingsEvent.volumeFurni = parser.volumeFurni;
        settingsEvent.volumeTrax = parser.volumeTrax;
        settingsEvent.oldChat = parser.oldChat;
        settingsEvent.roomInvites = parser.roomInvites;
        settingsEvent.cameraFollow = parser.cameraFollow;
        settingsEvent.flags = parser.flags;
        settingsEvent.chatType = parser.chatType;
        settingsEvent.onlineStatusVisible = parser.onlineStatusVisible;
        settingsEvent.friendsCanFollow = parser.friendsCanFollow;
        settingsEvent.friendRequestsAllowed = parser.friendRequestsAllowed;
        settingsEvent.profileVisible = parser.profileVisible;

        publish(settingsEvent);
        setOnlineIndicatorPreference(parser.onlineIndicatorPreference);
        DispatchMainEvent(settingsEvent);
    });

    useEffect(() =>
    {
        if (userSettings) DispatchUiEvent(userSettings);
    }, [userSettings]);

    /** Room invites and camera follow are saved at once; volumes change locally until commitVolumes. */
    const processAction = useCallback((type: UserSettingsAction, value?: boolean | number) =>
    {
        const current = userSettingsRef.current;
        if (!current) return;
        const clone = current.clone();

        switch (type)
        {
            case 'room_invites':
                clone.roomInvites = value as boolean;
                SendMessageComposer(new UserSettingsRoomInvitesComposer(clone.roomInvites));
                break;
            case 'camera_follow':
                clone.cameraFollow = value as boolean;
                SendMessageComposer(new UserSettingsCameraFollowComposer(clone.cameraFollow));
                break;
            case 'system_volume':
                clone.volumeSystem = clampVolume(value as number);
                break;
            case 'furni_volume':
                clone.volumeFurni = clampVolume(value as number);
                break;
            case 'trax_volume':
                clone.volumeTrax = clampVolume(value as number);
                break;
        }

        publish(clone);
        DispatchMainEvent(clone);
    }, [publish]);

    const commitVolumes = useCallback(() =>
    {
        const current = userSettingsRef.current;
        if (!current) return;

        SendMessageComposer(new UserSettingsSoundComposer(Math.round(current.volumeSystem), Math.round(current.volumeFurni), Math.round(current.volumeTrax)));
    }, []);

    const saveOnlineIndicator = useCallback((value: number) =>
    {
        setOnlineIndicatorPreference(value);
        SendMessageComposer(new UserSettingsOnlineIndicatorComposer(value));
    }, []);

    return { userSettings, onlineIndicatorPreference, processAction, commitVolumes, saveOnlineIndicator };
};

export const useUserSettings = () => useSharedHook(useUserSettingsState);

registerSharedHook(useUserSettingsState);
