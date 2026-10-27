import { AddLinkEventTracker, CreateLinkEvent, GetSessionDataManager, ILinkEventTracker, PerkEnum, RemoveLinkEventTracker } from '@volt/renderer';
import { CSSProperties, FC, ReactNode, useEffect, useRef, useState } from 'react';
import { MessengerIconState, MessengerThread } from '../../../api';
import { useFriends, useInventoryUnseenTracker, useMessenger } from '../../../hooks';
import { useCityStatus } from '../../../hooks/roleplay/useCityStatus';
import { useRoom } from '../../../hooks/rooms/useRoom';
import { usePerkAllowed } from '../../../state/perkAllowancesStore';
import { PhoneFriendsApp } from './PhoneFriendsApp';
import { PhoneMessagesApp, threadPreview } from './PhoneMessagesApp';
import { PhoneSettingsApp } from './PhoneSettingsApp';
import { PHONE_GLYPHS } from './PhoneShared';
import './PhoneView.scss';

type PhoneApp = 'home' | 'messages' | 'friends' | 'settings';
type App = { id: string; label: string; glyph: ReactNode; count?: number; run: () => void };
type Banner = { threadId: number; name: string; text: string };

const DND_KEY = 'districtrp.phone.dnd';
const BANNER_MS = 4500;

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const readDoNotDisturb = () =>
{
    try
    {
        return window.localStorage.getItem(DND_KEY) === '1';
    }
    catch
    {
        return false;
    }
};

/** The thread whose unread count went up since the previous thread list, if any. */
const newlyUnread = (previous: MessengerThread[], next: MessengerThread[]) =>
    next.find(thread => thread.unreadCount > (previous.find(old => old.threadId === thread.threadId)?.unreadCount ?? 0)) ?? null;

/** The DistrictRP phone: home screen, in-phone Messages, Friends and Settings apps, and launchers for the inventory and shop windows. */
export const PhoneView: FC = () =>
{
    const [open, setOpen] = useState(false);
    const [app, setApp] = useState<PhoneApp>('home');
    const [threadId, setThreadId] = useState(0);
    const [doNotDisturb, setDoNotDisturb] = useState(readDoNotDisturb);
    const [banner, setBanner] = useState<Banner>(null);
    const screen = useRef<HTMLDivElement>(null);
    const { city } = useCityStatus();
    const { requests } = useFriends();
    const { iconState, visibleThreads, getMessageThread } = useMessenger();
    const { getFullCount } = useInventoryUnseenTracker();
    const { roomSession } = useRoom();
    const cameraAllowed = usePerkAllowed(PerkEnum.CAMERA);
    const [seenThreads, setSeenThreads] = useState(visibleThreads);

    // A message arriving while its thread is not on screen shows a banner above the phone button.
    if (seenThreads !== visibleThreads)
    {
        setSeenThreads(visibleThreads);
        const fresh = newlyUnread(seenThreads, visibleThreads);
        const viewing = open && app === 'messages' && threadId === fresh?.threadId;

        if (fresh && !viewing && !doNotDisturb) setBanner({ threadId: fresh.threadId, name: fresh.participant.name, text: threadPreview(fresh, GetSessionDataManager().userId) });
    }

    useEffect(() =>
    {
        if (!banner) return;
        const timer = setTimeout(() => setBanner(null), BANNER_MS);
        return () => clearTimeout(timer);
    }, [banner]);

    const openRef = useRef(open);

    useEffect(() =>
    {
        openRef.current = open;
        if (open) screen.current?.querySelector<HTMLElement>('button, input')?.focus();
    }, [open, app]);

    useEffect(() =>
    {
        const tracker: ILinkEventTracker = { eventUrlPrefix: 'phone/', linkReceived: url =>
        {
            const show = url === 'phone/show' || (url === 'phone/toggle' && !openRef.current);

            if (!show && url !== 'phone/hide' && url !== 'phone/toggle') return;
            if (!show)
            {
                setApp('home');
                setThreadId(0);
            }
            setOpen(show);
        } };
        AddLinkEventTracker(tracker);
        return () => RemoveLinkEventTracker(tracker);
    }, []);

    const goHome = () =>
    {
        setApp('home');
        setThreadId(0);
    };
    const close = () =>
    {
        setOpen(false);
        goHome();
    };
    const openThread = (id: number) =>
    {
        setApp('messages');
        setThreadId(id);
    };
    const messageUser = (userId: number) =>
    {
        const thread = getMessageThread(userId);

        if (thread) openThread(thread.threadId);
    };
    const changeDoNotDisturb = (value: boolean) =>
    {
        setDoNotDisturb(value);
        if (value) setBanner(null);
        try
        {
            window.localStorage.setItem(DND_KEY, value ? '1' : '0');
        }
        catch
        {
            // Private windows can refuse storage; the setting then lasts for this session only.
        }
    };
    const openBanner = () =>
    {
        if (!banner) return;
        setOpen(true);
        openThread(banner.threadId);
        setBanner(null);
    };

    const unreadThreads = visibleThreads.filter(thread => thread.unread).length;
    const apps: App[] = [
        { id: 'messages', label: 'Messages', glyph: PHONE_GLYPHS.messages, count: unreadThreads || (iconState === MessengerIconState.UNREAD ? 1 : 0), run: () => setApp('messages') },
        { id: 'friends', label: 'Friends', glyph: PHONE_GLYPHS.friends, count: requests.length, run: () => setApp('friends') },
        { id: 'inventory', label: 'Inventory', glyph: PHONE_GLYPHS.inventory, count: getFullCount, run: () =>
        {
            close();
            CreateLinkEvent('inventory/toggle');
        } },
        { id: 'shop', label: 'Shop', glyph: PHONE_GLYPHS.shop, run: () =>
        {
            close();
            CreateLinkEvent('catalog/toggle/normal');
        } },
        // The camera photographs the current room, so it is only offered inside one (and with the camera perk).
        ...(roomSession && cameraAllowed ? [{ id: 'camera', label: 'Camera', glyph: PHONE_GLYPHS.camera, run: () =>
        {
            close();
            CreateLinkEvent('camera/toggle');
        } }] : []),
        { id: 'settings', label: 'Settings', glyph: PHONE_GLYPHS.settings, run: () => setApp('settings') }
    ];
    const icon = (entry: App) => (
        <button type="button" key={entry.id} className={`district-phone__app is-${entry.id}`} aria-label={entry.count ? `${entry.label}, ${entry.count}` : entry.label} onClick={entry.run}>
            <span className="district-phone__icon">{entry.glyph}{!!entry.count && <b>{entry.count}</b>}</span>
            <span className="district-phone__label">{entry.label}</span>
        </button>
    );
    const phase = city ? `${city.isDay ? 'Day' : 'Night'} · ${Math.ceil(city.phaseRemainingMs / 60000)} min left` : 'Synchronizing';

    return (
        <>
            {banner && !open && (
                <button type="button" className="district-phone-banner" onClick={openBanner} aria-label={`Message from ${banner.name}: ${banner.text}`}>
                    <span className="district-phone-banner__icon">{PHONE_GLYPHS.messages}</span>
                    <span className="district-phone-banner__text"><strong>{banner.name}</strong><small>{banner.text}</small></span>
                </button>
            )}
            <section
                className={`district-phone ${open ? 'is-open' : ''}`}
                aria-label="Phone"
                aria-hidden={!open}
                inert={!open}
                style={city ? { '--phone-sky': hex(city.backdropColor) } as CSSProperties : undefined}
                onKeyDown={event =>
                {
                    if (event.key !== 'Escape') return;
                    event.stopPropagation();
                    close();
                }}>
                <div className="district-phone__screen" ref={screen}>
                    <div className="district-phone__status">
                        <time>{city?.time ?? '--:--'}</time>
                        <span className="district-phone__island" aria-hidden="true" />
                        {doNotDisturb && <span className="district-phone__dnd" title="Do not disturb" aria-label="Do not disturb">☾</span>}
                        <span className="district-phone__signal" aria-hidden="true"><i /><i /><i /><i /></span>
                        <span className="district-phone__battery" aria-hidden="true" />
                    </div>
                    {app === 'home' && (
                        <>
                            <div className="district-phone__widget">
                                <strong>{city?.time ?? '--:--'}</strong>
                                <span>{phase}</span>
                            </div>
                            <div className="district-phone__grid">{apps.slice(2).map(icon)}</div>
                            <div className="district-phone__dock">{apps.slice(0, 2).map(icon)}</div>
                        </>
                    )}
                    {app === 'messages' && <PhoneMessagesApp threadId={threadId} onOpenThread={openThread} onHome={goHome} />}
                    {app === 'friends' && <PhoneFriendsApp onMessage={messageUser} onHome={goHome} />}
                    {app === 'settings' && <PhoneSettingsApp doNotDisturb={doNotDisturb} onDoNotDisturb={changeDoNotDisturb} onHome={goHome} />}
                    <button type="button" className="district-phone__home" aria-label={app === 'home' ? 'Close phone' : 'Home'} onClick={app === 'home' ? close : goHome} />
                </div>
            </section>
        </>
    );
};
