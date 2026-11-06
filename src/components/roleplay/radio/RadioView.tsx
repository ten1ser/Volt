import { AddLinkEventTracker, ILinkEventTracker, RemoveLinkEventTracker } from '@volt/renderer';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { GetLocalStorage, SetLocalStorage } from '../../../api';
import { DraggableWindowPosition, VoltCardView } from '../../../common';
import { useConnectionState } from '../../../hooks/events/useConnectionState';
import { PUBLIC_MAX, PUBLIC_MIN, RadioChannel, useRpRadio } from '../../../hooks/roleplay/useRpRadio';
import './RadioView.scss';

const CHANNEL_NAMES: Record<number, string> = {
    [RadioChannel.Public]: 'Public',
    [RadioChannel.Hospital]: 'Hospital',
    [RadioChannel.Gang]: 'Gang'
};
const PULSE_MS = 700;
const RECENT_KEY = 'district.radio.recent';
// One more than shown, so the current frequency can be left out and three still remain.
const RECENT_STORED = 4;
const RECENT_SHOWN = 3;

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

const readRecent = (): number[] =>
{
    const stored = GetLocalStorage<unknown>(RECENT_KEY);

    return Array.isArray(stored) ? stored.filter((value): value is number => Number.isInteger(value) && value >= PUBLIC_MIN && value <= PUBLIC_MAX).slice(0, RECENT_STORED) : [];
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
    const [recent, setRecent] = useState<number[]>(readRecent);
    const frame = useRef<HTMLDivElement>(null);
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
    const statusPowered = !!status?.powered;

    useEffect(() =>
    {
        if(statusChannel === RadioChannel.Public && statusFrequency) setFrequency('');
    }, [statusChannel, statusFrequency]);

    // Every public frequency the server confirms goes to the front of the recent list (adjusted while rendering, saved after).
    const confirmedPublic = statusPowered && statusChannel === RadioChannel.Public && statusFrequency ? statusFrequency : 0;

    if(confirmedPublic && recent[0] !== confirmedPublic) setRecent([confirmedPublic, ...recent.filter(value => value !== confirmedPublic)].slice(0, RECENT_STORED));

    useEffect(() =>
    {
        try
        {
            SetLocalStorage(RECENT_KEY, recent);
        }
        catch
        {
            // Storage is a convenience; the list still works for this session.
        }
    }, [recent]);

    const canTune = statusPowered && !pending;
    const onPublic = statusChannel === RadioChannel.Public;
    const rangeError = `Enter a public frequency from ${formatFrequency(PUBLIC_MIN)} to ${formatFrequency(PUBLIC_MAX)}.`;

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
            setInputError(rangeError);
            return;
        }
        setInputError('');
        tune(RadioChannel.Public, value);
    };
    // One tenth up or down from the draft, else the tuned public frequency, else the bottom of the band.
    const stepFrequency = (delta: number) =>
    {
        if(!canTune) return;
        const base = parseFrequency(frequency) ?? (onPublic && statusFrequency ? statusFrequency : PUBLIC_MIN);

        setInputError('');
        setFrequency(formatFrequency(Math.min(PUBLIC_MAX, Math.max(PUBLIC_MIN, base + delta))));
    };
    const selectChannel = (channel: number) =>
    {
        if(!canTune) return;

        if(channel === RadioChannel.Public)
        {
            const value = parseFrequency(frequency) ?? (onPublic && statusFrequency ? statusFrequency : null);

            if(value === null)
            {
                setInputError(rangeError);
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
    const recentChips = recent.filter(value => !(onPublic && value === statusFrequency)).slice(0, RECENT_SHOWN);

    return <VoltCardView theme="district" uniqueKey="district-radio" className="district-radio-window district-rp-window" isResizable={false} constrainToViewport windowPosition={DraggableWindowPosition.BOTTOM_LANE}>
        <div
            ref={frame}
            className={`district-radio${minimized ? ' is-minimized' : ''}`}
            role="region"
            aria-label="Radio"
            onKeyDown={event =>
            {
                if(event.key !== 'Escape') return;
                event.preventDefault();
                event.stopPropagation();
                close();
            }}>
            <header className="district-rp-titlebar drag-handler">
                <span>District Radio</span>
                {minimized && <strong className="district-radio__mini-frequency">{committed}</strong>}
                {!minimized && statusPowered && <button type="button" className="district-rp-tool district-radio__power" aria-label="Power off" title="Power off" disabled={pending} onClick={togglePower}>Off</button>}
                {minimized
                    ? <button ref={restoreButton} type="button" className="district-rp-tool" aria-label="Restore radio" title="Restore" onClick={() => setMinimized(false)}>+</button>
                    : <button type="button" className="district-rp-tool district-radio__minimize" aria-label="Minimize radio" title="Minimize" onClick={() => setMinimized(true)}>–</button>}
                <button type="button" className="district-rp-close" aria-label="Close radio" onClick={close}>×</button>
            </header>
            {!minimized && <div className="district-radio__body">
                {/* One status light (TX/RX flash over ON/OFF) and the frequency shown once. */}
                <div className="district-radio__lcd" aria-live="polite">
                    <div className="district-radio__lcd-row">
                        <span className={`district-radio__state is-${stateKey}`}><i aria-hidden="true" />{stateText}</span>
                        <span>{status ? CHANNEL_NAMES[status.channel] ?? label : label}</span>
                    </div>
                    <strong>{display}</strong>
                    {!!lcdNote && <span className="district-radio__lcd-note">{lcdNote}</span>}
                </div>
                {!statusPowered && <button type="button" className="district-radio__power district-radio__power-on district-btn is-primary" aria-pressed={false} disabled={!status || pending} onClick={togglePower}>Power on</button>}
                {/* Switched off, the handset collapses to power and frequency; channels and tuner return with power. */}
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
                    <div className="district-radio__tuner">
                        <button type="button" className="district-radio__step" aria-label="Lower frequency" disabled={!canTune} onClick={() => stepFrequency(-1)}>−</button>
                        <input
                            className="district-radio__tuner-input"
                            aria-label="Public frequency"
                            inputMode="decimal"
                            pattern="[0-9]*[.]?[0-9]?"
                            maxLength={5}
                            value={frequency}
                            placeholder="Freq."
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
                            }} />
                        <button type="button" className="district-radio__step" aria-label="Raise frequency" disabled={!canTune} onClick={() => stepFrequency(1)}>+</button>
                        <button type="button" className="district-radio__tune district-btn is-primary" disabled={!canTune} onClick={submitFrequency}>Tune</button>
                    </div>
                    {recentChips.length > 0 && <div className="district-radio__recent" role="group" aria-label="Recent frequencies">
                        {recentChips.map(value => <button key={value} type="button" disabled={!canTune} onClick={() =>
                        {
                            setInputError('');
                            setFrequency('');
                            tune(RadioChannel.Public, value);
                        }}>{formatFrequency(value)}</button>)}
                    </div>}
                </>}
                {notice && (
                    <div className={`district-radio__notice ${notice.refused ? 'is-refused' : ''}`} role="alert">
                        <span>{notice.text}</span>
                        <button type="button" aria-label="Dismiss message" onClick={clearNotice}>×</button>
                    </div>
                )}
                {!!inputError && <p className="district-radio__error" role="alert">{inputError}</p>}
                {!poweredOff && <p className="district-radio__tx-hint"><kbd>:r &lt;message&gt;</kbd> to transmit</p>}
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
            </div>}
        </div>
    </VoltCardView>;
};
