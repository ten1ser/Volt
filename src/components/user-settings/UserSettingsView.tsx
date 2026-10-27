import { AddLinkEventTracker, ILinkEventTracker, RemoveLinkEventTracker } from '@volt/renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { GetConfigurationValue, localizeWithFallback } from '../../api';
import { HabboDropMenuView } from '../../common/dropmenu/HabboDropMenuView';
import { useChatPreferences } from '../../hooks/useChatPreferences';
import { useUserSettings } from '../../hooks/useUserSettings';
import { AirSettingsVolumeRow } from './AirSettingsVolumeRow';
import { CustomWordFilterSettingsView } from './CustomWordFilterSettingsView';
import { SettingsWindow } from './SettingsWindow';

type SettingsSection = 'audio' | 'chat' | 'other' | 'wordfilter';
type VolumeAction = 'system_volume' | 'furni_volume' | 'trax_volume';

const SECTIONS: SettingsSection[] = ['audio', 'chat', 'other', 'wordfilter'];
const CLOSED: Record<SettingsSection, boolean> = { audio: false, chat: false, other: false, wordfilter: false };

const DropMenu: FC<{ label: string; left: number; top: number; width: number; value: number; options: string[]; onSelect: (value: number) => void }> = (props) => {
    const { label, left, top, width, value, options, onSelect } = props;

    return (
        <HabboDropMenuView
            className="us-drop"
            label={label}
            style={{ left, top, width }}
            value={value}
            options={options.map((option, index) => ({ value: index, label: option }))}
            onSelect={onSelect}
        />
    );
};

export const UserSettingsView: FC<{}> = () => {
    const [open, setOpen] = useState<Record<SettingsSection, boolean>>(CLOSED);
    const [disableWiredWhisper, setDisableWiredWhisper] = useState(false);
    const { chatPreferences, updateChatPreferences } = useChatPreferences();
    const { userSettings, onlineIndicatorPreference, processAction, commitVolumes, saveOnlineIndicator } = useUserSettings();
    const wasAudioOpenRef = useRef(false);

    const close = (section: SettingsSection) => setOpen((previous) => ({ ...previous, [section]: false }));

    // v75: dragging a slider and the mute/maximum icons only update the volumes locally (processAction); FMe.dispose then sets
    // all three volumes, and each setter sends the same packet, so closing the sound window sends them even when nothing changed.
    // One equivalent packet is sent here.
    const changeVolume = (type: VolumeAction, value: number) => processAction(type, value);

    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split('/');

                if (parts.length < 2) return;

                const section = SECTIONS.find((value) => value === parts[2]);

                switch (parts[1]) {
                    case 'show':
                        if (section) setOpen((previous) => ({ ...previous, [section]: true }));
                        return;
                    case 'hide':
                        setOpen(section ? (previous) => ({ ...previous, [section]: false }) : CLOSED);
                        return;
                    case 'toggle':
                        if (section) setOpen((previous) => ({ ...previous, [section]: !previous[section] }));
                        return;
                }
            },
            eventUrlPrefix: 'user-settings/'
        };

        AddLinkEventTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, []);

    // Closing the sound window (Back, hide or toggle) is its dispose: send the current volumes once.
    useEffect(() => {
        if (wasAudioOpenRef.current && !open.audio && userSettings) commitVolumes();

        wasAudioOpenRef.current = open.audio;
    }, [open.audio, userSettings, commitVolumes]);

    if (!userSettings || !chatPreferences) return null;

    const backLabel = localizeWithFallback('widget.memenu.back', localizeWithFallback('generic.back', 'Back'));
    const muteLabel = localizeWithFallback('widget.memenu.settings.volume.mute', 'Mute');
    const maximumLabel = localizeWithFallback('widget.memenu.settings.volume.maximum', 'Maximum volume');
    const showCameraFollow = GetConfigurationValue<boolean>('room.camera.follow_user', false);
    const showWordFilter = GetConfigurationValue<boolean>('user.custom.filter.enabled', false);

    return (
        <>
            {open.audio && (
                <SettingsWindow
                    lineWidth={292}
                    lineX={11}
                    name="audio"
                    title={localizeWithFallback('widget.memenu.settings.title', 'Settings')}
                    titleWidth={126}
                    titleX={94}
                    width={312}
                >
                    <div className="us-at us-text" style={{ left: 83, top: 33, width: 148, height: 17, textAlign: 'center' }}>
                        {localizeWithFallback('widget.memenu.settings.volume', 'Adjust the sound volume')}
                    </div>
                    <AirSettingsVolumeRow
                        id="volumeSystem"
                        label={localizeWithFallback('widget.memenu.settings.volume.ui', 'System')}
                        maximumLabel={maximumLabel}
                        muteLabel={muteLabel}
                        top={49}
                        value={userSettings.volumeSystem}
                        onChange={(value) => changeVolume('system_volume', value)}
                    />
                    <AirSettingsVolumeRow
                        id="volumeFurni"
                        label={localizeWithFallback('widget.memenu.settings.volume.furni', 'Furni')}
                        maximumLabel={maximumLabel}
                        muteLabel={muteLabel}
                        top={77}
                        value={userSettings.volumeFurni}
                        onChange={(value) => changeVolume('furni_volume', value)}
                    />
                    <AirSettingsVolumeRow
                        id="volumeTrax"
                        label={localizeWithFallback('widget.memenu.settings.volume.trax', 'Trax')}
                        maximumLabel={maximumLabel}
                        muteLabel={muteLabel}
                        top={105}
                        value={userSettings.volumeTrax}
                        onChange={(value) => changeVolume('trax_volume', value)}
                    />
                    <button className="us-button us-at" style={{ left: 11, top: 133, width: 60 }} type="button" onClick={() => close('audio')}>
                        {backLabel}
                    </button>
                </SettingsWindow>
            )}
            {open.chat && (
                <SettingsWindow
                    lineWidth={237}
                    lineX={11}
                    name="chat"
                    title={localizeWithFallback('toolbar.chat.settings.title', 'Chat settings')}
                    titleWidth={144}
                    titleX={57}
                    width={257}
                >
                    <div className="us-at us-text us-text--multi" style={{ left: 11, top: 34, width: 237, height: 32 }}>
                        {localizeWithFallback('toolbar.chat.settings.info', 'Choose how chat appears for you')}
                    </div>
                    <div className="us-at us-text" style={{ left: 11, top: 71, width: 237, height: 17 }}>
                        {localizeWithFallback('toolbar.chat.settings.mode', 'Chat mode')}
                    </div>
                    <DropMenu
                        label={localizeWithFallback('toolbar.chat.settings.mode', 'Chat mode')}
                        left={11}
                        options={[
                            localizeWithFallback('navigator.roomsettings.chat.mode.free.flow', 'Free flow'),
                            localizeWithFallback('navigator.roomsettings.chat.mode.line.by.line', 'Line by line')
                        ]}
                        top={92}
                        value={chatPreferences.chatMode}
                        width={237}
                        onSelect={(value) => updateChatPreferences({ ...chatPreferences, chatMode: value })}
                    />
                    <div className="us-at us-text" style={{ left: 11, top: 120, width: 237, height: 17 }}>
                        {localizeWithFallback('toolbar.chat.settings.bubble_width', 'Bubble width')}
                    </div>
                    <DropMenu
                        label={localizeWithFallback('toolbar.chat.settings.bubble_width', 'Bubble width')}
                        left={11}
                        options={[
                            localizeWithFallback('navigator.roomsettings.chat.bubbles.width.wide', 'Wide'),
                            localizeWithFallback('navigator.roomsettings.chat.bubbles.width.normal', 'Normal'),
                            localizeWithFallback('navigator.roomsettings.chat.bubbles.width.thin', 'Thin')
                        ]}
                        top={141}
                        value={chatPreferences.chatBubbleWidth}
                        width={237}
                        onSelect={(value) => updateChatPreferences({ ...chatPreferences, chatBubbleWidth: value })}
                    />
                    <div className="us-at us-text" style={{ left: 11, top: 169, width: 237, height: 17 }}>
                        {localizeWithFallback('toolbar.chat.settings.scroll_speed', 'Scroll speed')}
                    </div>
                    <DropMenu
                        label={localizeWithFallback('toolbar.chat.settings.scroll_speed', 'Scroll speed')}
                        left={11}
                        options={[
                            localizeWithFallback('navigator.roomsettings.chat.speed.fast', 'Fast'),
                            localizeWithFallback('navigator.roomsettings.chat.speed.normal', 'Normal'),
                            localizeWithFallback('navigator.roomsettings.chat.speed.slow', 'Slow')
                        ]}
                        top={190}
                        value={chatPreferences.chatScrollSpeed}
                        width={237}
                        onSelect={(value) => updateChatPreferences({ ...chatPreferences, chatScrollSpeed: value })}
                    />
                    <button className="us-button us-at" style={{ left: 11, top: 230, width: 60 }} type="button" onClick={() => close('chat')}>
                        {backLabel}
                    </button>
                </SettingsWindow>
            )}
            {open.other && (
                <SettingsWindow
                    lineWidth={162}
                    lineX={41}
                    name="other"
                    title={localizeWithFallback('widget.memenu.other.settings.title', 'Other settings')}
                    titleWidth={153}
                    titleX={46}
                    width={242}
                >
                    <div className="us-other-list">
                        <label className="us-check-row">
                            <input
                                checked={userSettings.roomInvites}
                                className="us-check"
                                type="checkbox"
                                onChange={(event) => processAction('room_invites', event.target.checked)}
                            />
                            <span>{localizeWithFallback('memenu.settings.other.ignore.room.invites', 'Ignore Room Invites')}</span>
                        </label>
                        {showCameraFollow && (
                            <label className="us-check-row">
                                <input
                                    checked={userSettings.cameraFollow}
                                    className="us-check"
                                    type="checkbox"
                                    onChange={(event) => processAction('camera_follow', event.target.checked)}
                                />
                                <span>{localizeWithFallback('memenu.settings.other.disable.room.camera.follow', "Don't focus on own avatar")}</span>
                            </label>
                        )}
                        <label className="us-check-row">
                            <input checked={disableWiredWhisper} className="us-check" type="checkbox" onChange={(event) => setDisableWiredWhisper(event.target.checked)} />
                            <span>{localizeWithFallback('memenu.settings.wired_whisper_read_disable', 'Disable whispering to Wired')}</span>
                        </label>
                        <div className="us-text us-label">
                            {localizeWithFallback('memenu.settings.other.friend.online.notification.title', 'Show "friend online" notification for:')}
                        </div>
                        <DropMenu
                            label={localizeWithFallback('memenu.settings.other.friend.online.notification.title', 'Show "friend online" notification for:')}
                            left={0}
                            options={[
                                localizeWithFallback('memenu.settings.other.friend.online.notification.0', 'Everyone'),
                                localizeWithFallback('memenu.settings.other.friend.online.notification.1', 'Users in my relationship status'),
                                localizeWithFallback('memenu.settings.other.friend.online.notification.2', 'Nobody')
                            ]}
                            top={0}
                            value={onlineIndicatorPreference}
                            width={222}
                            onSelect={saveOnlineIndicator}
                        />
                    </div>
                    <button className="us-button us-other-back" type="button" onClick={() => close('other')}>
                        {backLabel}
                    </button>
                </SettingsWindow>
            )}
            {open.wordfilter && showWordFilter && <CustomWordFilterSettingsView onClose={() => close('wordfilter')} />}
        </>
    );
};
