import { RpHospitalCallRespondComposer, RpHospitalCallsEvent, RpRadioRequestComposer, RpRadioStatusEvent, RpRadioTransmissionEvent } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { registerSharedHook, useSharedHook } from '../../state/useSharedHook';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';
import { useUserDataSnapshot } from '../session/useSessionSnapshots';

/** Wire actions of packet 6120. */
export const RadioAction = { Status: 0, Power: 1, Tune: 2, Transmit: 3 } as const;
export const RadioChannel = { Public: 0, Hospital: 1, Gang: 2 } as const;
export const PUBLIC_MIN = 1001;
export const PUBLIC_MAX = 9999;
export const MAX_MESSAGES = 100;

export interface RadioStatus
{
    powered: boolean;
    channel: number;
    frequency: number;
    channelLabel: string;
    hospitalAccess: boolean;
    gangAccess: boolean;
    /** Powered radios on this channel, this one included; 0 while switched off. */
    listeners: number;
}

export interface RadioTransmission
{
    id: number;
    channel: number;
    frequency: number;
    channelLabel: string;
    senderId: number;
    senderName: string;
    senderRank: string;
    text: string;
    sentAt: number;
}

export interface HospitalCall
{
    number: number;
    patientId: number;
    patientName: string;
    location: string;
    openedAt: number;
}

export type RadioNotice = { text: string; refused: boolean };

let nextRequestId = 0;
const allocateRequestId = () =>
{
    nextRequestId = nextRequestId % 2147483647 + 1;
    return nextRequestId;
};

const send = (composer: () => unknown) =>
{
    try
    {
        SendMessageComposer(composer() as Parameters<typeof SendMessageComposer>[0]);
        return true;
    }
    catch
    {
        return false;
    }
};
/**
 * Packet 6120/6121 state for the built-in radio. The server owns power, channel, access and identity; this hook only
 * records authoritative status and real transmissions, correlates its own notices, and keeps the session feed bounded.
 */
export const useRpRadioSource = () =>
{
    const { authenticated } = useConnectionState();
    const [status, setStatus] = useState<RadioStatus | null>(null);
    const [notice, setNotice] = useState<RadioNotice | null>(null);
    const [messages, setMessages] = useState<RadioTransmission[]>([]);
    const [calls, setCalls] = useState<HospitalCall[]>([]);
    const [pending, setPending] = useState(false);
    const [callPending, setCallPending] = useState(false);
    const outstanding = useRef<{ id: number; timer: number } | null>(null);
    const callsOutstanding = useRef<{ id: number; timer: number } | null>(null);
    const nextMessageId = useRef(0);
    const account = useRef(0);
    const userData = useUserDataSnapshot();
    const accountId = Number(userData?.userId) || 0;
    // Event handlers outlive the render that registered them, so they read the current session from a ref.
    const session = useRef({ authenticated, accountId });
    session.current.authenticated = authenticated;
    session.current.accountId = accountId;
    const activeSession = () => session.current.authenticated && session.current.accountId > 0;

    const invalidate = useCallback(() =>
    {
        if(outstanding.current) window.clearTimeout(outstanding.current.timer);
        outstanding.current = null;
        setPending(false);
    }, []);
    const invalidateCalls = useCallback(() =>
    {
        if(callsOutstanding.current) window.clearTimeout(callsOutstanding.current.timer);
        callsOutstanding.current = null;
        setCallPending(false);
    }, []);
    useMessageEvent<RpRadioStatusEvent>(RpRadioStatusEvent, useCallback(event =>
    {
        if(!activeSession()) return;
        const parser = event.getParser();
        // Only the reply to the request in flight may change state; a late reply must not overwrite newer state.
        // A push (requestId 0) refreshes the authoritative status without consuming a pending request.
        if(parser.requestId !== 0 && parser.requestId !== outstanding.current?.id) return;
        setStatus({
            powered: parser.powered, channel: parser.channel, frequency: parser.frequency, channelLabel: parser.channelLabel,
            hospitalAccess: parser.hospitalAccess, gangAccess: parser.gangAccess, listeners: parser.listeners
        });
        if(parser.requestId === 0) return;
        if(parser.notice) setNotice({ text: parser.notice, refused: parser.refused });
        invalidate();
    }, [invalidate]));

    useMessageEvent<RpRadioTransmissionEvent>(RpRadioTransmissionEvent, useCallback(event =>
    {
        if(!activeSession()) return;
        const parser = event.getParser();
        const message = {
            id: ++nextMessageId.current, channel: parser.channel, frequency: parser.frequency, channelLabel: parser.channelLabel,
            senderId: parser.senderId, senderName: parser.senderName, senderRank: parser.senderRank, text: parser.text, sentAt: parser.sentAt
        };
        setMessages(previous => [...previous.slice(-(MAX_MESSAGES - 1)), message]);
    }, []));

    useMessageEvent<RpHospitalCallsEvent>(RpHospitalCallsEvent, useCallback(event =>
    {
        if(!activeSession()) return;
        const parser = event.getParser();
        // A push (requestId 0) refreshes the list without consuming the request in flight.
        if(parser.requestId !== 0 && parser.requestId !== callsOutstanding.current?.id) return;
        setCalls(parser.calls.map(call => ({
            number: call.number, patientId: call.patientId, patientName: call.patientName, location: call.location, openedAt: call.openedAt
        })));
        if(parser.requestId === 0) return;
        invalidateCalls();
        if(parser.notice) setNotice({ text: parser.notice, refused: false });
    }, [invalidateCalls]));
    // A different account (or a sign-out) starts with no radio state from the previous session.
    useEffect(() =>
    {
        if(account.current === accountId && authenticated) return;
        account.current = accountId;
        if(outstanding.current) window.clearTimeout(outstanding.current.timer);
        outstanding.current = null;
        setPending(false);
        setStatus(null);
        setNotice(null);
        setMessages([]);
        if(callsOutstanding.current) window.clearTimeout(callsOutstanding.current.timer);
        callsOutstanding.current = null;
        setCallPending(false);
        setCalls([]);
        nextMessageId.current = 0;
    }, [accountId, authenticated]);
    const request = useCallback((action: number, channel: number, frequency: number, text = '') =>
    {
        if(!activeSession() || outstanding.current) return false;
        const id = allocateRequestId();
        setNotice(null);
        setPending(true);
        const timer = window.setTimeout(() =>
        {
            if(outstanding.current?.id !== id) return;
            invalidate();
            setNotice({ text: 'No response from the server.', refused: true });
        }, 10000);
        outstanding.current = { id, timer };
        if(!send(() => new RpRadioRequestComposer(id, action, channel, frequency, text)))
        {
            invalidate();
            setNotice({ text: 'The radio could not reach the server.', refused: true });
            return false;
        }
        return true;
    }, [invalidate]);
    const respond = useCallback((number: number) =>
    {
        if(!activeSession() || callsOutstanding.current) return false;
        const id = allocateRequestId();
        setCallPending(true);
        const timer = window.setTimeout(() =>
        {
            if(callsOutstanding.current?.id !== id) return;
            invalidateCalls();
            setNotice({ text: 'No response from the server.', refused: true });
        }, 10000);
        callsOutstanding.current = { id, timer };
        if(!send(() => new RpHospitalCallRespondComposer(id, number)))
        {
            invalidateCalls();
            setNotice({ text: 'The radio could not reach the server.', refused: true });
            return false;
        }
        return true;
    }, [invalidateCalls]);
    const refreshCalls = useCallback(() => respond(0), [respond]);

    // Reading the status once signed in hands out the free radio and opens its authoritative channel.
    useEffect(() =>
    {
        if(!authenticated || accountId < 1) return;
        request(RadioAction.Status, 0, 0);
    }, [authenticated, accountId, request]);
    // The dispatch list exists only while the radio is powered on the hospital channel.
    const poweredHospital = !!status?.powered && status.channel === RadioChannel.Hospital;
    useEffect(() =>
    {
        if(!authenticated || accountId < 1) return;
        if(poweredHospital)
        {
            refreshCalls();
            return;
        }
        setCalls([]);
    }, [authenticated, accountId, poweredHospital, refreshCalls]);
    // A shared hook host can outlive a session; never leave a response timer behind.
    useEffect(() => () =>
    {
        if(outstanding.current) window.clearTimeout(outstanding.current.timer);
        outstanding.current = null;
        if(callsOutstanding.current) window.clearTimeout(callsOutstanding.current.timer);
        callsOutstanding.current = null;
    }, []);
    const refresh = useCallback(() => request(RadioAction.Status, 0, 0), [request]);
    const power = useCallback((on: boolean) => request(RadioAction.Power, on ? 1 : 0, 0), [request]);
    const tune = useCallback((channel: number, frequency: number) =>
        request(RadioAction.Tune, channel, channel === RadioChannel.Public ? frequency : 0), [request]);
    const transmit = useCallback((text: string) =>
    {
        const current = status;
        if(!current?.powered || text.length < 1 || text.length > 120) return false;
        return request(RadioAction.Transmit, current.channel, current.channel === RadioChannel.Public ? current.frequency : 0, text);
    }, [request, status]);
    const clearNotice = useCallback(() => setNotice(null), []);

    return {
        status: authenticated ? status : null,
        notice,
        messages,
        calls: authenticated ? calls : [],
        pending: authenticated && pending,
        callPending: authenticated && callPending,
        refresh,
        respond,
        refreshCalls,
        power,
        tune,
        transmit,
        clearNotice
    };
};

export const useRpRadio = () => useSharedHook(useRpRadioSource);
registerSharedHook(useRpRadioSource);