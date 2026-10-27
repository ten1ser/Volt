import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { GetConfigurationValue } from '../../../api';
import { useChatPreferences } from '../../../hooks/useChatPreferences';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { PhoneHeader } from './PhoneShared';

type Page = 'main' | 'sound' | 'chat' | 'privacy';
type VolumeAction = 'system_volume' | 'furni_volume' | 'trax_volume';

const VOLUME_COMMIT_DELAY_MS = 600;

const Toggle: FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="district-phone__setting">
        <span>{label}</span>
        <input type="checkbox" role="switch" className="district-phone__switch" checked={checked} onChange={event => onChange(event.target.checked)} />
    </label>
);

const Choice: FC<{ label: string; value: number; options: string[]; onChange: (value: number) => void }> = ({ label, value, options, onChange }) => (
    <div className="district-phone__setting is-stacked">
        <span>{label}</span>
        <div className="district-phone__segments" role="radiogroup" aria-label={label}>
            {options.map((option, index) => (
                <button type="button" role="radio" key={option} aria-checked={value === index} className={value === index ? 'is-active' : ''} onClick={() => onChange(index)}>{option}</button>
            ))}
        </div>
    </div>
);

const Link: FC<{ label: string; detail?: string; onOpen: () => void }> = ({ label, detail, onOpen }) => (
    <button type="button" className="district-phone__setting is-link" onClick={onOpen}>
        <span>{label}</span>{detail && <small>{detail}</small>}<i aria-hidden="true">›</i>
    </button>
);

const Group: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
    <section className="district-phone__group">
        <h3 className="district-phone__group-label">{title}</h3>
        <div className="district-phone__group-card">{children}</div>
    </section>
);

/** Settings: phone preferences plus the hotel's own sound, chat, privacy and camera settings (saved exactly as the settings windows save them). */
export const PhoneSettingsApp: FC<{ doNotDisturb: boolean; onDoNotDisturb: (value: boolean) => void; onHome: () => void }> = ({ doNotDisturb, onDoNotDisturb, onHome }) =>
{
    const [page, setPage] = useState<Page>('main');
    const { userSettings, onlineIndicatorPreference, processAction, commitVolumes, saveOnlineIndicator } = useUserSettings();
    const { chatPreferences, updateChatPreferences } = useChatPreferences();
    const commitTimer = useRef<ReturnType<typeof setTimeout>>(null);

    // Volumes apply live; the server is told once the slider settles (and when leaving the page).
    useEffect(() => () =>
    {
        if (!commitTimer.current) return;
        clearTimeout(commitTimer.current);
        commitVolumes();
    }, [commitVolumes]);

    const changeVolume = (type: VolumeAction, value: number) =>
    {
        processAction(type, value);
        if (commitTimer.current) clearTimeout(commitTimer.current);
        commitTimer.current = setTimeout(() =>
        {
            commitTimer.current = null;
            commitVolumes();
        }, VOLUME_COMMIT_DELAY_MS);
    };
    const back = () => setPage('main');

    if (!userSettings || !chatPreferences) return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Settings" backLabel="Home" onBack={onHome} />
            <p className="district-phone__empty">Loading settings…</p>
        </div>
    );

    if (page === 'sound') return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Sound" backLabel="Settings" onBack={back} />
            <Group title="Volume">
                {([['system_volume', 'System', userSettings.volumeSystem], ['furni_volume', 'Furni', userSettings.volumeFurni], ['trax_volume', 'Trax', userSettings.volumeTrax]] as [VolumeAction, string, number][]).map(([type, label, value]) => (
                    <label key={type} className="district-phone__setting is-stacked">
                        <span>{label} <small>{Math.round(value)}%</small></span>
                        <input type="range" className="district-phone__slider" min={0} max={100} step={1} value={Math.round(value)} aria-label={`${label} volume`} onChange={event => changeVolume(type, Number(event.target.value))} />
                    </label>
                ))}
            </Group>
        </div>
    );

    if (page === 'chat') return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Chat" backLabel="Settings" onBack={back} />
            <Group title="Room chat">
                <Choice label="Chat mode" value={chatPreferences.chatMode} options={['Free flow', 'Line by line']} onChange={value => updateChatPreferences({ ...chatPreferences, chatMode: value })} />
                <Choice label="Bubble width" value={chatPreferences.chatBubbleWidth} options={['Wide', 'Normal', 'Thin']} onChange={value => updateChatPreferences({ ...chatPreferences, chatBubbleWidth: value })} />
                <Choice label="Scroll speed" value={chatPreferences.chatScrollSpeed} options={['Fast', 'Normal', 'Slow']} onChange={value => updateChatPreferences({ ...chatPreferences, chatScrollSpeed: value })} />
            </Group>
        </div>
    );

    if (page === 'privacy') return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Privacy" backLabel="Settings" onBack={back} />
            <Group title="Invites">
                <Toggle label="Ignore room invites" checked={userSettings.roomInvites} onChange={value => processAction('room_invites', value)} />
            </Group>
            <Group title="Friend online alerts">
                <Choice label="Show alerts for" value={onlineIndicatorPreference ?? 0} options={['Everyone', 'Relationships', 'Nobody']} onChange={saveOnlineIndicator} />
            </Group>
        </div>
    );

    return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Settings" backLabel="Home" onBack={onHome} />
            <Group title="Phone">
                <Toggle label="Do not disturb" checked={doNotDisturb} onChange={onDoNotDisturb} />
            </Group>
            <Group title="Hotel">
                <Link label="Sound" detail={`${Math.round(userSettings.volumeSystem)}%`} onOpen={() => setPage('sound')} />
                <Link label="Chat" onOpen={() => setPage('chat')} />
                <Link label="Privacy" onOpen={() => setPage('privacy')} />
                {GetConfigurationValue<boolean>('room.camera.follow_user', false) && <Toggle label="Don't focus on my avatar" checked={userSettings.cameraFollow} onChange={value => processAction('camera_follow', value)} />}
            </Group>
        </div>
    );
};
