import { AddLinkEventTracker, CreateLinkEvent, GetSessionDataManager, ILinkEventTracker, PerkEnum, RemoveLinkEventTracker } from '@volt/renderer';
import { CSSProperties, FC, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { DispatchUiEvent, GetConfigurationValue, MessengerIconState, MessengerThread } from '../../../api';
import { Permission } from '../../../api/permissions';
import { GuideToolEvent } from '../../../events';
import { useBuildHeight, useFriends, useHasPermission, useInventoryUnseenTracker, useMessenger, useOpenIssueCount, useWiredTools } from '../../../hooks';
import { useCityStatus } from '../../../hooks/roleplay/useCityStatus';
import { CallState, useRpPhone } from '../../../hooks/roleplay/useRpPhone';
import { useRoom } from '../../../hooks/rooms/useRoom';
import { usePerkAllowed } from '../../../state/perkAllowancesStore';
import { PhoneCallScreen, PhoneOfferSheet } from './PhoneCallScreen';
import { PhoneCameraApp } from './PhoneCameraApp';
import { PhoneDialerApp } from './PhoneDialerApp';
import { PhoneFriendsApp } from './PhoneFriendsApp';
import { PhoneMessagesApp, threadPreview } from './PhoneMessagesApp';
import { PhoneSettingsApp } from './PhoneSettingsApp';
import { PHONE_GLYPHS, PhoneNoSim } from './PhoneShared';
import './PhoneView.scss';

type PhoneApp = 'home' | 'dialer' | 'messages' | 'friends' | 'settings' | 'camera';
type App = { id: string; label: string; glyph: ReactNode; count?: number; run: () => void };
type Banner = { threadId: number; name: string; text: string };

const DND_KEY = 'districtrp.phone.dnd';
const POSITION_KEY = 'districtrp.phone.position';
const EDGE = 8;
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

type Offset = { x: number; y: number };

const readPosition = (): Offset =>
{
    try
    {
        const saved = JSON.parse(window.localStorage.getItem(POSITION_KEY) ?? 'null') as Partial<Offset> | null;

        return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? { x: saved.x, y: saved.y } : { x: 0, y: 0 };
    }
    catch
    {
        return { x: 0, y: 0 };
    }
};

const savePosition = (offset: Offset) =>
{
    try
    {
        window.localStorage.setItem(POSITION_KEY, JSON.stringify(offset));
    }
    catch
    {
        // Without storage the phone still moves; it returns to its corner next session.
    }
};

/** Keeps the moved phone fully on screen: the offset is from its resting corner (bottom right), so it can only go left and up. */
const clampOffset = (offset: Offset, width: number, height: number, restLeft: number, restTop: number): Offset => ({
    x: Math.min(0, Math.max(EDGE - restLeft, offset.x)),
    y: Math.min(window.innerHeight - EDGE - restTop - height, Math.max(EDGE - restTop, offset.y))
});

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
    const frame = useRef<HTMLElement>(null);
    const drag = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset; restLeft: number; restTop: number; last: Offset } | null>(null);
    const [offset, setOffset] = useState<Offset>(readPosition);
    const { city } = useCityStatus();
    const { requests } = useFriends();
    const { iconState, visibleThreads, getMessageThread } = useMessenger();
    const { getFullCount } = useInventoryUnseenTracker();
    const { roomSession } = useRoom();
    const cameraAllowed = usePerkAllowed(PerkEnum.CAMERA);
    const guideAllowed = usePerkAllowed(PerkEnum.USE_GUIDE_TOOL);
    const isMod = useHasPermission(Permission.ModerationTool);
    const openIssues = useOpenIssueCount();
    const { openMonitor, showToolbarButton } = useWiredTools();
    const { available: buildHeightAvailable, toggle: toggleBuildHeight } = useBuildHeight();
    const [seenThreads, setSeenThreads] = useState(visibleThreads);
    const { status, call, lines, offer, answer, hangUp, respondOffer } = useRpPhone();
    const [seenAlert, setSeenAlert] = useState('');

    // A ringing call or a staff sale offer takes the phone out of the pocket.
    const alert = call?.state === CallState.Incoming ? `call:${call.callId}` : offer ? `offer:${offer.offerId}` : '';
    if (alert !== seenAlert)
    {
        setSeenAlert(alert);
        if (alert && !open) setOpen(true);
    }

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

    // Dragging the status bar moves the phone anywhere on screen; double-clicking it puts the phone back.
    const startDrag = (event: ReactPointerEvent<HTMLDivElement>) =>
    {
        if (event.button !== 0 || !frame.current) return;
        const rect = frame.current.getBoundingClientRect();
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: offset, restLeft: rect.left - offset.x, restTop: rect.top - offset.y, last: offset };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) =>
    {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId || !frame.current) return;
        const next = { x: current.origin.x + event.clientX - current.startX, y: current.origin.y + event.clientY - current.startY };
        current.last = clampOffset(next, frame.current.offsetWidth, frame.current.offsetHeight, current.restLeft, current.restTop);
        setOffset(current.last);
    };
    const endDrag = (event: ReactPointerEvent<HTMLDivElement>) =>
    {
        const current = drag.current;
        if (current?.pointerId !== event.pointerId) return;
        drag.current = null;
        savePosition(current.last);
    };
    const resetPosition = () =>
    {
        setOffset({ x: 0, y: 0 });
        savePosition({ x: 0, y: 0 });
    };

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
    // Tools open their own windows, so the phone is put away first.
    const launch = (action: () => void) => () =>
    {
        close();
        action();
    };
    const openBanner = () =>
    {
        if (!banner) return;
        setOpen(true);
        openThread(banner.threadId);
        setBanner(null);
    };

    // Messages and Friends run on the SIM card; without one the phone only does emergency calls and the hotel tools.
    const noSim = !!status && !status.hasSim;
    const unreadThreads = visibleThreads.filter(thread => thread.unread).length;
    const apps: App[] = [
        { id: 'dialer', label: 'Phone', glyph: PHONE_GLYPHS.phone, run: () => setApp('dialer') },
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
        ...(roomSession && cameraAllowed ? [{ id: 'camera', label: 'Camera', glyph: PHONE_GLYPHS.camera, run: () => setApp('camera') }] : []),
        // Former dock "More" tools, with the same gates.
        ...(isMod ? [{ id: 'modtools', label: 'Moderation', glyph: PHONE_GLYPHS.modtools, count: openIssues, run: launch(() => CreateLinkEvent('mod-tools/show')) }] : []),
        ...(roomSession && showToolbarButton ? [{ id: 'wired', label: 'Wired', glyph: PHONE_GLYPHS.wired, run: launch(openMonitor) }] : []),
        ...(roomSession && buildHeightAvailable ? [{ id: 'build', label: 'Build height', glyph: PHONE_GLYPHS.build, run: launch(toggleBuildHeight) }] : []),
        ...(GetConfigurationValue('games_icon_enabled', GetConfigurationValue('game.center.enabled', false)) ? [{ id: 'games', label: 'Games', glyph: PHONE_GLYPHS.games, run: launch(() => CreateLinkEvent('games/toggle')) }] : []),
        ...(GetConfigurationValue('toolbar.stories.enabled', false) ? [{ id: 'stories', label: 'Stories', glyph: PHONE_GLYPHS.stories, run: launch(() => CreateLinkEvent('stories/toggle')) }] : []),
        ...(guideAllowed && GetConfigurationValue('guides.enabled') ? [{ id: 'helper', label: 'Helper', glyph: PHONE_GLYPHS.helper, run: launch(() => DispatchUiEvent(new GuideToolEvent(GuideToolEvent.TOGGLE_GUIDE_TOOL))) }] : []),
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
                ref={frame}
                className={`district-phone ${open ? 'is-open' : ''}`}
                aria-label="Phone"
                aria-hidden={!open}
                inert={!open}
                style={{ ...(city ? { '--phone-sky': hex(city.backdropColor) } : {}), '--phone-x': `${offset.x}px`, '--phone-y': `${offset.y}px` } as CSSProperties}
                onKeyDown={event =>
                {
                    if (event.key !== 'Escape') return;
                    event.stopPropagation();
                    close();
                }}>
                <div className="district-phone__screen" ref={screen}>
                    <div className="district-phone__status" title="Drag to move the phone, double-click to put it back" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={resetPosition}>
                        <time>{city?.time ?? '--:--'}</time>
                        <span className="district-phone__island" aria-hidden="true" />
                        {doNotDisturb && <span className="district-phone__dnd" title="Do not disturb" aria-label="Do not disturb">☾</span>}
                        {status?.hasSim
                            ? <span className="district-phone__signal" aria-label="Signal"><i /><i /><i /><i /></span>
                            : <span className="district-phone__no-sim">No SIM</span>}
                        <span className="district-phone__battery" aria-hidden="true" />
                    </div>
                    {!call && app === 'home' && (
                        <>
                            <div className="district-phone__widget">
                                <strong>{city?.time ?? '--:--'}</strong>
                                <span>{phase}</span>
                                <span className="district-phone__line">{status ? (status.hasSim ? `${status.number} · ${status.load} Load` : `No SIM card · ${status.load} Load`) : ''}</span>
                            </div>
                            <div className="district-phone__grid">{apps.slice(3).map(icon)}</div>
                            <div className="district-phone__dock">{apps.slice(0, 3).map(icon)}</div>
                        </>
                    )}
                    {call && <PhoneCallScreen call={call} lines={lines} onAnswer={answer} onHangUp={hangUp} />}
                    {!call && app === 'dialer' && <PhoneDialerApp onHome={goHome} />}
                    {!call && app === 'messages' && (noSim ? <PhoneNoSim title="Messages" onHome={goHome} /> : <PhoneMessagesApp threadId={threadId} onOpenThread={openThread} onHome={goHome} />)}
                    {!call && app === 'friends' && (noSim ? <PhoneNoSim title="Friends" onHome={goHome} /> : <PhoneFriendsApp onMessage={messageUser} onHome={goHome} />)}
                    {!call && app === 'settings' && <PhoneSettingsApp doNotDisturb={doNotDisturb} onDoNotDisturb={changeDoNotDisturb} onHome={goHome} />}
                    {!call && app === 'camera' && (roomSession ? <PhoneCameraApp onHome={goHome} /> : <p className="district-phone__empty">Enter a room to use the camera.</p>)}
                    {offer && <PhoneOfferSheet offer={offer} onRespond={respondOffer} />}
                    <button type="button" className="district-phone__home" aria-label={app === 'home' ? 'Close phone' : 'Home'} onClick={app === 'home' ? close : goHome} />
                </div>
            </section>
        </>
    );
};
