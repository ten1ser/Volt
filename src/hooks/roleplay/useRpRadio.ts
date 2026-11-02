import { GetSessionDataManager, RpRadioRequestComposer, RpRadioStatusEvent, RpRadioTransmissionEvent } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { registerSharedHook, useSharedHook } from '../../state/useSharedHook';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';

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
    const [unread, setUnread] = useState(0);
    const [pending, setPending] = useState(false);
    const outstanding = useRef<{ id: number; timer: number } | null>(null);
    const nextMessageId = useRef(0);
    const account = useRef(0);
    const accountId = (() =>
    {
        try
        {
            return Number(GetSessionDataManager().userId) || 0;
        }
        catch
        {
            return 0;
        }
    })();
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
    useMessageEvent<RpRadioStatusEvent>(RpRadioStatusEvent, useCallback(event =>
    {
        if(!activeSession()) return;
        const parser = event.getParser();
        // Only the reply to the request in flight may change state; a late reply must not overwrite newer state.
        // A push (requestId 0) refreshes the authoritative status without consuming a pending request.
        if(parser.requestId !== 0 && parser.requestId !== outstanding.current?.id) return;
        setStatus({
            powered: parser.powered, channel: parser.channel, frequency: parser.frequency, channelLabel: parser.channelLabel,
            hospitalAccess: parser.hospitalAccess, gangAccess: parser.gangAccess
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
        setUnread(previous => Math.min(99, previous + 1));
    }, []));
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
        setUnread(0);
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

    // Reading the status once signed in hands out the free radio and opens its authoritative channel.
    useEffect(() =>
    {
        if(!authenticated || accountId < 1) return;
        request(RadioAction.Status, 0, 0);
    }, [authenticated, accountId, request]);
    // A shared hook host can outlive a session; never leave a response timer behind.
    useEffect(() => () =>
    {
        if(outstanding.current) window.clearTimeout(outstanding.current.timer);
        outstanding.current = null;
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
    const clear = useCallback(() =>
    {
        setMessages([]);
        setUnread(0);
    }, []);
    const markRead = useCallback(() => setUnread(0), []);
    const clearNotice = useCallback(() => setNotice(null), []);

    return {
        status: authenticated ? status : null,
        notice,
        messages,
        unread,
        pending: authenticated && pending,
        refresh,
        power,
        tune,
        transmit,
        clear,
        markRead,
        clearNotice
    };
};

export const useRpRadio = () => useSharedHook(useRpRadioSource);
registerSharedHook(useRpRadioSource);