import { AddLinkEventTracker, ILinkEventTracker, RemoveLinkEventTracker } from '@volt/renderer';
import { CSSProperties, FC, PointerEvent as ReactPointerEvent, RefObject, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useConnectionState } from '../../../hooks/events/useConnectionState';
import { PUBLIC_MAX, PUBLIC_MIN, RadioChannel, useRpRadio } from '../../../hooks/roleplay/useRpRadio';
import './RadioView.scss';

const CHANNEL_NAMES: Record<number, string> = {
    [RadioChannel.Public]: 'Public',
    [RadioChannel.Hospital]: 'Hospital',
    [RadioChannel.Gang]: 'Gang'
};
const PULSE_MS = 700;
const TX_HINT = ':r <message> to transmit';
const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];
const LOG_DEFAULTS = { opacity: 92, width: 300, text: 12 };
const LOG_LIMITS = { opacity: [20, 100], width: [240, 520], text: [11, 16] };
const PANEL_MARGIN = 8;
const INTERACTIVE = 'button, input, select, textarea, a, [role="button"], [role="slider"], [contenteditable="true"]';

const channelName = (channel: number, label = '') => label || CHANNEL_NAMES[channel] || 'Radio';

const formatFrequency = (frequency: number) => (frequency / 10).toFixed(1);

const parseFrequency = (value: string) =>
{
    const match = /^(\d{1,3})(?:\.(\d)?)?$/.exec(value.trim());

    if(!match) return null;
    const frequency = Number(match[1]) * 10 + Number(match[2] ?? 0);

    return frequency >= PUBLIC_MIN && frequency <= PUBLIC_MAX ? frequency : null;
};

const sanitizeFrequency = (value: string) =>
{
    const [whole = '', ...fraction] = value.replace(/[^\d.]/g, '').split('.');

    return fraction.length ? `${whole.slice(0, 3)}.${fraction.join('').slice(0, 1)}` : whole.slice(0, 3);
};

const formatTime = (sentAt: number) =>
{
    const date = new Date(sentAt * 1000);

    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface PanelPosition
{
    x: number;
    y: number;
}

const clampPanelPosition = (x: number, y: number, width: number, height: number): PanelPosition =>
{
    const maxX = Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN);
    const maxY = Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN);

    return {
        x: Math.round(Math.min(Math.max(PANEL_MARGIN, x), maxX)),
        y: Math.round(Math.min(Math.max(PANEL_MARGIN, y), maxY))
    };
};

const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest(INTERACTIVE);

/** Pointer dragging for one fixed panel. Positions live only in memory for the session. */
const usePanelDrag = (ref: RefObject<HTMLElement | null>) =>
{
    const [position, setPosition] = useState<PanelPosition | null>(null);
    const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

    const clamp = useCallback((adopt = false) =>
    {
        const element = ref.current;

        if(!element) return;
        const rect = element.getBoundingClientRect();

        setPosition(current =>
        {
            if(!current && !adopt) return current;
            const base = current ?? { x: rect.left, y: rect.top };
            const next = clampPanelPosition(base.x, base.y, rect.width, rect.height);

            return current && next.x === current.x && next.y === current.y ? current : next;
        });
    }, [ref]);

    const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) =>
    {
        if(event.pointerType === 'mouse' && event.button !== 0) return;
        if(isInteractiveTarget(event.target)) return;
        const element = ref.current;

        if(!element) return;
        const rect = element.getBoundingClientRect();

        drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top };
        setPosition(clampPanelPosition(rect.left, rect.top, rect.width, rect.height));
        try
        {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        catch
        {
            // Pointer capture is an enhancement; handlers still work without it.
        }
        event.preventDefault();
    }, [ref]);

    const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) =>
    {
        const active = drag.current;

        if(!active || active.pointerId !== event.pointerId) return;
        const element = ref.current;

        if(!element) return;
        const rect = element.getBoundingClientRect();

        setPosition(clampPanelPosition(
            active.originX + (event.clientX - active.startX),
            active.originY + (event.clientY - active.startY),
            rect.width,
            rect.height
        ));
    }, [ref]);

    const onPointerEnd = useCallback((event: ReactPointerEvent<HTMLElement>) =>
    {
        if(drag.current?.pointerId !== event.pointerId) return;
        drag.current = null;
        try
        {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        catch
        {
            // Releasing an uncaptured pointer is harmless.
        }
    }, []);

    return { position, clamp, dragHandlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd } };
};

/** The built-in radio: a compact handset plus an independent server-fed log. The server owns power, channel and access. */
export const RadioView: FC = () =>
{
    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [feedOpen, setFeedOpen] = useState(true);
    // An empty log stays hidden until the first transmission, unless the player opens it with Log.
    const [logChosen, setLogChosen] = useState(false);
    const [frequency, setFrequency] = useState('');
    const [inputError, setInputError] = useState('');
    const [muted, setMuted] = useState(true);
    const [volume, setVolume] = useState(0.35);
    const [pulse, setPulse] = useState<'tx' | 'rx' | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [logOpacity, setLogOpacity] = useState(LOG_DEFAULTS.opacity);
    const [logWidth, setLogWidth] = useState(LOG_DEFAULTS.width);
    const [logText, setLogText] = useState(LOG_DEFAULTS.text);
    const frame = useRef<HTMLElement>(null);
    const logPanel = useRef<HTMLElement>(null);
    const logList = useRef<HTMLOListElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const restoreButton = useRef<HTMLButtonElement>(null);
    const wasMinimized = useRef(false);
    const openRef = useRef(open);
    const minimizedRef = useRef(minimized);
    const pulseTimer = useRef<number | null>(null);
    const audio = useRef<AudioContext | null>(null);
    const previousMessageId = useRef(0);
    const id = useId();
    const { authenticated } = useConnectionState();
    const { status, notice, messages, pending, refresh, power, tune, clear, markRead, clearNotice } = useRpRadio();
    const handsetDrag = usePanelDrag(frame);
    const logDrag = usePanelDrag(logPanel);
    openRef.current = open;
    minimizedRef.current = minimized;

    const pulseFor = useCallback((kind: 'tx' | 'rx') =>
    {
        if(pulseTimer.current) window.clearTimeout(pulseTimer.current);
        setPulse(kind);
        pulseTimer.current = window.setTimeout(() =>
        {
            pulseTimer.current = null;
            setPulse(null);
        }, PULSE_MS);
    }, []);

    const playClick = useCallback((silent: boolean) =>
    {
        if(silent) return;
        try
        {
            const Context = window.AudioContext;

            if(!Context) return;
            const context = audio.current ?? new Context();
            audio.current = context;
            if(context.state === 'suspended') void context.resume().catch(() => undefined);
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = 'square';
            oscillator.frequency.value = 640;
            gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.05;
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.05);
        }
        catch
        {
            // Sound is optional and must never interfere with radio traffic.
        }
    }, [volume]);

    const close = useCallback(() =>
    {
        setOpen(false);
        setMinimized(false);
    }, []);
    const openRadio = useCallback(() =>
    {
        if(!openRef.current)
        {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            openRef.current = true;
        }
        setMinimized(false);
        setOpen(true);
    }, []);

    useEffect(() =>
    {
        const tracker: ILinkEventTracker = { eventUrlPrefix: 'radio/', linkReceived: url =>
        {
            if(url === 'radio/show') openRadio();
            else if(url === 'radio/hide' || (url === 'radio/toggle' && openRef.current && !minimizedRef.current)) close();
            else if(url === 'radio/toggle') openRadio();
        } };
        AddLinkEventTracker(tracker);
        return () => RemoveLinkEventTracker(tracker);
    }, [close, openRadio]);

    // Opening reads the authoritative status again, retires the dock badge and focuses the first control.
    useEffect(() =>
    {
        if(!open) return;
        refresh();
        markRead();
        frame.current?.querySelector<HTMLButtonElement>('.district-radio__power')?.focus();
        return () =>
        {
            if(opener.current?.isConnected) opener.current.focus();
        };
    }, [open, refresh, markRead]);

    // Minimizing must not leave focus on a control that is about to disappear.
    useEffect(() =>
    {
        if(!open) return;
        if(minimized)
        {
            wasMinimized.current = true;
            restoreButton.current?.focus();
        }
        else if(wasMinimized.current)
        {
            wasMinimized.current = false;
            frame.current?.querySelector<HTMLButtonElement>('.district-radio__minimize')?.focus();
        }
    }, [open, minimized]);

    useEffect(() =>
    {
        if(!authenticated)
        {
            setOpen(false);
            setMinimized(false);
        }
    }, [authenticated]);

    // Either panel changing size or the viewport moving has to bring it back inside.
    useLayoutEffect(() =>
    {
        if(open) handsetDrag.clamp();
    }, [open, minimized, notice, inputError, handsetDrag.clamp]);
    useLayoutEffect(() =>
    {
        if(open && feedOpen) logDrag.clamp();
    }, [open, feedOpen, logWidth, logText, settingsOpen, logDrag.clamp]);

    useEffect(() =>
    {
        if(!open) return;
        const clampAll = () =>
        {
            handsetDrag.clamp(true);
            if(feedOpen) logDrag.clamp(true);
        };
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(clampAll);

        window.addEventListener('resize', clampAll);
        window.addEventListener('orientationchange', clampAll);
        if(observer)
        {
            if(frame.current) observer.observe(frame.current);
            if(feedOpen && logPanel.current) observer.observe(logPanel.current);
        }
        return () =>
        {
            window.removeEventListener('resize', clampAll);
            window.removeEventListener('orientationchange', clampAll);
            observer?.disconnect();
        };
    }, [open, feedOpen, handsetDrag.clamp, logDrag.clamp]);

    // The feed is capped, so its length stops changing; the newest unique id is what marks new traffic.
    const latestMessageId = messages.length ? messages[messages.length - 1].id : 0;
    const visibleMessages = messages.slice(-5);
    const showLog = feedOpen && (visibleMessages.length > 0 || logChosen);

    // Whatever is on screen is read; closing leaves the remaining count for the dock badge.
    useEffect(() =>
    {
        if(open && latestMessageId > 0) markRead();
    }, [open, latestMessageId, markRead]);

    // New traffic scrolls the log to the bottom even when the capped feed keeps five rows.
    useEffect(() =>
    {
        if(!open || !feedOpen) return;
        const list = logList.current;

        if(list) list.scrollTop = list.scrollHeight;
    }, [open, feedOpen, latestMessageId]);

    useEffect(() =>
    {
        const isNew = latestMessageId > previousMessageId.current;

        previousMessageId.current = latestMessageId;
        if(!open || !isNew) return;
        pulseFor('rx');
        playClick(muted);
    }, [latestMessageId, open, muted, pulseFor, playClick]);

    useEffect(() => () =>
    {
        if(pulseTimer.current) window.clearTimeout(pulseTimer.current);
        if(audio.current)
        {
            try
            {
                void audio.current.close();
            }
            catch
            {
                // An already closed context needs no further cleanup.
            }
            audio.current = null;
        }
    }, []);

    // A committed public frequency replaces a stale draft; the draft only holds what the user is entering.
    const statusChannel = status?.channel;
    const statusFrequency = status?.frequency;

    useEffect(() =>
    {
        if(statusChannel === RadioChannel.Public && statusFrequency) setFrequency('');
    }, [statusChannel, statusFrequency]);

    const canTune = !!status?.powered && !pending;
    const onPublic = statusChannel === RadioChannel.Public;

    const togglePower = () =>
    {
        if(!status || pending) return;
        power(!status.powered);
    };
    const submitFrequency = () =>
    {
        if(!canTune) return;
        const value = parseFrequency(frequency);

        if(value === null)
        {
            setInputError(`Enter a public frequency from ${formatFrequency(PUBLIC_MIN)} to ${formatFrequency(PUBLIC_MAX)}.`);
            return;
        }
        setInputError('');
        tune(RadioChannel.Public, value);
    };
    const pressKey = (key: string) =>
    {
        if(!canTune) return;
        setInputError('');
        setFrequency(current =>
        {
            if(key === '.' && (!current || current.includes('.'))) return current;
            return sanitizeFrequency(`${current}${key}`);
        });
    };
    const backspaceFrequency = () =>
    {
        if(!canTune) return;
        setInputError('');
        setFrequency(current => current.slice(0, -1));
    };
    const clearFrequency = () =>
    {
        setInputError('');
        setFrequency('');
    };
    const selectChannel = (channel: number) =>
    {
        if(!canTune) return;

        if(channel === RadioChannel.Public)
        {
            const value = parseFrequency(frequency) ?? (onPublic && statusFrequency ? statusFrequency : null);

            if(value === null)
            {
                setInputError(`Enter a public frequency from ${formatFrequency(PUBLIC_MIN)} to ${formatFrequency(PUBLIC_MAX)}.`);
                return;
            }
            setInputError('');
            tune(channel, value);
            return;
        }
        setInputError('');
        tune(channel, 0);
    };
    const resetLogSettings = () =>
    {
        setLogOpacity(LOG_DEFAULTS.opacity);
        setLogWidth(LOG_DEFAULTS.width);
        setLogText(LOG_DEFAULTS.text);
    };

    const toggleLog = () =>
    {
        if(showLog)
        {
            setFeedOpen(false);
            return;
        }
        setLogChosen(true);
        setFeedOpen(true);
    };

    if(!open) return null;

    const label = status ? channelName(status.channel, status.channelLabel) : 'Connecting';
    const committed = !status ? '— — —' : status.channel === RadioChannel.Public ? formatFrequency(status.frequency) : label;
    const display = frequency || committed;
    const lcdNote = !status ? 'Checking radio…' : pending ? 'Waiting for server…' : status.powered ? 'Ready' : 'Power on to talk';
    const poweredOff = !!status && !status.powered;
    const stateKey = pulse ?? (!status ? 'link' : status.powered ? 'on' : 'off');
    const stateText = pulse === 'tx' ? 'TX' : pulse === 'rx' ? 'RX' : !status ? 'LINK' : status.powered ? 'ON' : 'OFF';
    const privateHint = status && (!status.hospitalAccess || !status.gangAccess)
        ? [!status.hospitalAccess && 'Hospital needs on-duty access', !status.gangAccess && 'Gang needs membership'].filter(Boolean).join(' · ')
        : '';
    const logStyle = {
        '--radio-log-opacity': String(logOpacity / 100),
        '--radio-log-width': `${logWidth}px`,
        '--radio-log-text': `${logText}px`,
        ...(logDrag.position ? { left: logDrag.position.x, top: logDrag.position.y } : {})
    } as CSSProperties;
    const handsetStyle: CSSProperties = handsetDrag.position ? { left: handsetDrag.position.x, top: handsetDrag.position.y } : {};
    const handsetClass = `district-radio${minimized ? ' is-minimized' : ''}${handsetDrag.position ? ' is-positioned' : ''}`;
    const logClass = `district-radio__log${logDrag.position ? ' is-positioned' : ''}`;

    return (
        <>
            <section
                ref={frame}
                className={handsetClass}
                style={handsetStyle}
                role="region"
                aria-label="Radio"
                onKeyDown={event =>
                {
                    if(event.key !== 'Escape') return;
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                }}>
                {minimized ? (
                    <header className="district-radio__header district-radio__header--minimized" {...handsetDrag.dragHandlers}>
                        <h2>District Radio</h2>
                        <span className="district-radio__mini-frequency">{committed}</span>
                        <div className="district-radio__mini-actions">
                            <button ref={restoreButton} type="button" aria-label="Restore radio" onClick={() => setMinimized(false)}>Restore</button>
                            <button type="button" aria-pressed={showLog} onClick={toggleLog}>Log</button>
                            <button type="button" className="district-radio__close" aria-label="Close radio" onClick={close}>×</button>
                        </div>
                    </header>
                ) : (
                    <>
                        <span className="district-radio__antenna" aria-hidden="true" />
                        <div className="district-radio__body">
                        <header className="district-radio__header" {...handsetDrag.dragHandlers}>
                            <h2>District Radio</h2>
                            <button type="button" className="district-radio__log-toggle" aria-pressed={showLog} onClick={toggleLog}>Log</button>
                            <button type="button" className="district-radio__minimize" aria-label="Minimize radio" onClick={() => setMinimized(true)}>–</button>
                            <button type="button" className="district-radio__close" aria-label="Close radio" onClick={close}>×</button>
                        </header>
                        <span className="district-radio__speaker" aria-hidden="true" />
                        {/* One status light (TX/RX flash over ON/OFF) and the frequency shown once; the draft field only while it can tune. */}
                        <div className="district-radio__lcd" aria-live="polite">
                            <div className="district-radio__lcd-row">
                                <span className={`district-radio__state is-${stateKey}`}><i aria-hidden="true" />{stateText}</span>
                                <span>{status ? CHANNEL_NAMES[status.channel] ?? label : label}</span>
                            </div>
                            <strong>{display}</strong>
                            <span className="district-radio__lcd-note">{lcdNote}</span>
                            {!poweredOff && <input
                                className="district-radio__lcd-input"
                                aria-label="Public frequency"
                                inputMode="decimal"
                                pattern="[0-9]*[.]?[0-9]?"
                                maxLength={5}
                                value={frequency}
                                placeholder="New frequency"
                                disabled={!canTune}
                                onChange={event =>
                                {
                                    setFrequency(sanitizeFrequency(event.target.value));
                                    setInputError('');
                                }}
                                onKeyDown={event =>
                                {
                                    if(event.key !== 'Enter') return;
                                    event.preventDefault();
                                    submitFrequency();
                                }} />}
                        </div>
                        <button type="button" className="district-radio__power" aria-pressed={!!status?.powered} disabled={!status || pending} onClick={togglePower}>
                            {status?.powered ? 'Power off' : 'Power on'}
                        </button>
                        {/* Switched off, the handset collapses to power and frequency; channels and keypad return with power. */}
                        {!poweredOff && <>
                            <div className="district-radio__channels" role="group" aria-label="Channel">
                                <button type="button" aria-pressed={onPublic} disabled={!canTune} onClick={() => selectChannel(RadioChannel.Public)}>Public</button>
                                <button type="button" aria-pressed={statusChannel === RadioChannel.Hospital} disabled={!canTune || !status?.hospitalAccess}
                                    aria-description={status && !status.hospitalAccess ? 'Requires on-duty hospital access' : undefined}
                                    title={status && !status.hospitalAccess ? 'Requires on-duty hospital access' : undefined}
                                    onClick={() => selectChannel(RadioChannel.Hospital)}>Hospital</button>
                                <button type="button" aria-pressed={statusChannel === RadioChannel.Gang} disabled={!canTune || !status?.gangAccess}
                                    aria-description={status && !status.gangAccess ? 'Requires gang membership' : undefined}
                                    title={status && !status.gangAccess ? 'Requires gang membership' : undefined}
                                    onClick={() => selectChannel(RadioChannel.Gang)}>Gang</button>
                            </div>
                            {!!privateHint && <p className="district-radio__hint">{privateHint}</p>}
                            <div className="district-radio__keypad" role="group" aria-label="Frequency keypad">
                                {KEYPAD_KEYS.map(key => (
                                    <button key={key} type="button" className="district-radio__key" disabled={!canTune}
                                        aria-label={key === '.' ? 'Decimal point' : undefined}
                                        onClick={() => pressKey(key)}>{key}</button>
                                ))}
                                <button type="button" className="district-radio__key" aria-label="Backspace" disabled={!canTune} onClick={backspaceFrequency}>⌫</button>
                            </div>
                            <div className="district-radio__tune-actions">
                                <button type="button" disabled={!canTune} onClick={clearFrequency}>Clear</button>
                                <button type="button" className="district-radio__tune" disabled={!canTune} onClick={submitFrequency}>Tune</button>
                            </div>
                        </>}
                        {notice && (
                            <div className={`district-radio__notice ${notice.refused ? 'is-refused' : ''}`} role="alert">
                                <span>{notice.text}</span>
                                <button type="button" aria-label="Dismiss message" onClick={clearNotice}>×</button>
                            </div>
                        )}
                        {!!inputError && <p className="district-radio__error" role="alert">{inputError}</p>}
                        {!poweredOff && <p className="district-radio__tx-hint">{TX_HINT}</p>}
                        <div className="district-radio__audio">
                            <button type="button" aria-pressed={!muted} onClick={() =>
                            {
                                const next = !muted;

                                setMuted(next);
                                if(!next) playClick(false);
                            }}>{muted ? 'Sound off' : 'Sound on'}</button>
                            <input type="range" min={0} max={1} step={0.05} value={volume} aria-label="Volume" onChange={event => setVolume(Number(event.target.value))} />
                        </div>
                        </div>
                    </>
                )}
            </section>
            {showLog && (
                <aside ref={logPanel} id={`${id}-feed`} className={logClass} style={logStyle} role="complementary" aria-label="Radio log">
                    <header className="district-radio__log-header" {...logDrag.dragHandlers}>
                        <h3>Radio log</h3>
                        <span className="district-radio__log-count">{visibleMessages.length ? `${visibleMessages.length} shown` : 'Empty'}</span>
                        <button type="button" className="district-radio__log-button" aria-label="Clear log" disabled={!visibleMessages.length} onClick={clear}>Clear</button>
                        <button type="button" className="district-radio__log-settings-toggle" aria-label="Log settings"
                            aria-expanded={settingsOpen} aria-controls={`${id}-log-settings`}
                            onClick={() => setSettingsOpen(value => !value)}><span aria-hidden="true">⚙</span></button>
                        <button type="button" className="district-radio__log-settings-toggle" aria-label="Hide log" onClick={() => setFeedOpen(false)}>×</button>
                    </header>
                    {settingsOpen && (
                        <div id={`${id}-log-settings`} className="district-radio__log-settings">
                            <div className="district-radio__setting">
                                <span>Panel opacity <output>{logOpacity}%</output></span>
                                <input type="range" aria-label="Panel opacity" min={LOG_LIMITS.opacity[0]} max={LOG_LIMITS.opacity[1]} step={1}
                                    value={logOpacity} onChange={event => setLogOpacity(Number(event.target.value))} />
                            </div>
                            <div className="district-radio__setting">
                                <span>Log width <output>{logWidth}px</output></span>
                                <input type="range" aria-label="Log width" min={LOG_LIMITS.width[0]} max={LOG_LIMITS.width[1]} step={1}
                                    value={logWidth} onChange={event => setLogWidth(Number(event.target.value))} />
                            </div>
                            <div className="district-radio__setting">
                                <span>Text size <output>{logText}px</output></span>
                                <input type="range" aria-label="Text size" min={LOG_LIMITS.text[0]} max={LOG_LIMITS.text[1]} step={1}
                                    value={logText} onChange={event => setLogText(Number(event.target.value))} />
                            </div>
                            <button type="button" className="district-radio__settings-reset" onClick={resetLogSettings}>Reset defaults</button>
                        </div>
                    )}
                    {visibleMessages.length ? (
                        <ol ref={logList} className="district-radio__log-list" role="log" aria-live="polite">
                            {visibleMessages.map(entry => (
                                <li key={entry.id}>
                                    <div className="district-radio__log-meta">
                                        <strong>{entry.senderName}</strong>
                                        {!!entry.senderRank && <span className="district-radio__log-rank">{entry.senderRank}</span>}
                                        <span className="district-radio__log-channel">
                                            {entry.channel === RadioChannel.Public ? `Public · ${formatFrequency(entry.frequency)}` : channelName(entry.channel, entry.channelLabel)}
                                        </span>
                                        <time>{formatTime(entry.sentAt)}</time>
                                    </div>
                                    <p>{entry.text}</p>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="district-radio__log-empty">No radio traffic yet.</p>}
                </aside>
            )}
        </>
    );
};
