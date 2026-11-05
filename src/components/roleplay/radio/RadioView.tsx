import { AddLinkEventTracker, ILinkEventTracker, RemoveLinkEventTracker } from '@volt/renderer';
import { CSSProperties, FC, PointerEvent as ReactPointerEvent, RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/** The built-in radio handset. Transmissions are read in room chat; the server owns power, channel and access. */
export const RadioView: FC = () =>
{
    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [frequency, setFrequency] = useState('');
    const [inputError, setInputError] = useState('');
    const [muted, setMuted] = useState(true);
    const [volume, setVolume] = useState(0.35);
    const [pulse, setPulse] = useState<'tx' | 'rx' | null>(null);
    const frame = useRef<HTMLElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const restoreButton = useRef<HTMLButtonElement>(null);
    const wasMinimized = useRef(false);
    const openRef = useRef(open);
    const minimizedRef = useRef(minimized);
    const pulseTimer = useRef<number | null>(null);
    const audio = useRef<AudioContext | null>(null);
    const previousMessageId = useRef(0);
    const { authenticated } = useConnectionState();
    const { status, notice, messages, pending, refresh, power, tune, clearNotice } = useRpRadio();
    const handsetDrag = usePanelDrag(frame);
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

    // Opening reads the authoritative status again and focuses the first control.
    useEffect(() =>
    {
        if(!open) return;
        refresh();
        frame.current?.querySelector<HTMLButtonElement>('.district-radio__power')?.focus();
        return () =>
        {
            if(opener.current?.isConnected) opener.current.focus();
        };
    }, [open, refresh]);

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

    // The handset changing size or the viewport moving has to bring it back inside.
    useLayoutEffect(() =>
    {
        if(open) handsetDrag.clamp();
    }, [open, minimized, notice, inputError, handsetDrag.clamp]);

    useEffect(() =>
    {
        if(!open) return;
        const clampAll = () => handsetDrag.clamp(true);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(clampAll);

        window.addEventListener('resize', clampAll);
        window.addEventListener('orientationchange', clampAll);
        if(observer && frame.current) observer.observe(frame.current);
        return () =>
        {
            window.removeEventListener('resize', clampAll);
            window.removeEventListener('orientationchange', clampAll);
            observer?.disconnect();
        };
    }, [open, handsetDrag.clamp]);

    // The feed is capped, so its length stops changing; the newest unique id is what marks new traffic.
    const latestMessageId = messages.length ? messages[messages.length - 1].id : 0;

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
    if(!open) return null;

    const label = status ? channelName(status.channel, status.channelLabel) : 'Connecting';
    const committed = !status ? '— — —' : status.channel === RadioChannel.Public ? formatFrequency(status.frequency) : label;
    const display = frequency || committed;
    // Switched off, the OFF light and the Power on button already say it; no third line.
    const lcdNote = !status ? 'Checking radio…' : pending ? 'Waiting for server…'
        : !status.powered ? '' : status.listeners > 1 ? `${ status.listeners } connected` : status.listeners === 1 ? 'Only you connected' : 'Ready';
    const poweredOff = !!status && !status.powered;
    const stateKey = pulse ?? (!status ? 'link' : status.powered ? 'on' : 'off');
    const stateText = pulse === 'tx' ? 'TX' : pulse === 'rx' ? 'RX' : !status ? 'LINK' : status.powered ? 'ON' : 'OFF';
    const privateHint = status && (!status.hospitalAccess || !status.gangAccess)
        ? [!status.hospitalAccess && 'Hospital needs on-duty access', !status.gangAccess && 'Gang needs membership'].filter(Boolean).join(' · ')
        : '';
    const handsetStyle: CSSProperties = handsetDrag.position ? { left: handsetDrag.position.x, top: handsetDrag.position.y } : {};
    const handsetClass = `district-radio${minimized ? ' is-minimized' : ''}${handsetDrag.position ? ' is-positioned' : ''}`;

    return (
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
                        <button type="button" className="district-radio__close" aria-label="Close radio" onClick={close}>×</button>
                    </div>
                </header>
            ) : (
                <>
                    <div className="district-radio__body">
                    <header className="district-radio__header" {...handsetDrag.dragHandlers}>
                        <h2>District Radio</h2>
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
                        {!!lcdNote && <span className="district-radio__lcd-note">{lcdNote}</span>}
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
                    <button type="button" className={`district-radio__power district-btn${status?.powered ? '' : ' is-primary'}`} aria-pressed={!!status?.powered} disabled={!status || pending} onClick={togglePower}>
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
                        {/* Muted reads as zero on the slider; moving it turns the sound back on. */}
                        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume" onChange={event =>
                        {
                            const next = Number(event.target.value);

                            setVolume(next);
                            if(muted && next > 0) setMuted(false);
                        }} />
                    </div>
                    </div>
                </>
            )}
        </section>
    );
};
