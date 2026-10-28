import { RpPhoneCallActionComposer, RpPhoneCallEvent, RpPhoneCallLineEvent, RpPhoneHistoryEvent, RpPhoneLocationEvent, RpPhoneOfferEvent, RpPhoneOfferResponseComposer, RpPhoneRequestComposer, RpPhoneStatusEvent } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { registerSharedHook, useSharedHook } from '../../state/useSharedHook';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';

/** Wire actions of packets 6100 and 6101. */
export const PhoneAction = { Status: 0, Reset: 1, AddContact: 2, History: 3, Locate: 4, ShareLocation: 5 } as const;
export const CallAction = { Dial: 0, Answer: 1, HangUp: 2, CallContact: 3 } as const;
export const LocationState = { Hidden: 0, InRoom: 1, NotInRoom: 2, Offline: 3 } as const;
export const CallState = { Idle: 0, Dialing: 1, Incoming: 2, Active: 3 } as const;

export interface PhoneStatus
{
    hasSim: boolean;
    number: string;
    load: number;
    hospitalNumber: string;
    policeNumber: string;
    messageCost: number;
    callCost: number;
    callPeriodSeconds: number;
    shareLocation: boolean;
}

export interface PhoneCallRecord
{
    outgoing: boolean;
    answered: boolean;
    peerName: string;
    peerNumber: string;
    agoSeconds: number;
    durationSeconds: number;
}

export interface PhoneContactLocation
{
    state: number;
    roomName: string;
    message: string;
}

export interface PhoneCall
{
    state: number;
    callId: string;
    peerName: string;
    peerNumber: string;
    /** performance.now() when the call connected, for the timer. */
    connectedAt: number;
}

export interface PhoneCallLine
{
    fromSelf: boolean;
    speaker: string;
    text: string;
}

export interface PhoneOffer
{
    offerId: string;
    item: string;
    amount: number;
    price: number;
    seller: string;
    expiresAt: number;
}

export type PhoneNotice = { text: string; refused: boolean };

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
 * The phone's server state: SIM card, number and Load (6100), the current call (6101), its spoken lines (6103) and a staff
 * sale offer (6102). The status is read once the player is signed in, which also hands out the free phone's starter Load.
 */
const NO_LOCATIONS: Readonly<Record<number, PhoneContactLocation>> = Object.freeze({});

export const useRpPhoneSource = () =>
{
    const { authenticated } = useConnectionState();
    const [status, setStatus] = useState<PhoneStatus | null>(null);
    const [notice, setNotice] = useState<PhoneNotice | null>(null);
    const [call, setCall] = useState<PhoneCall | null>(null);
    const [callNotice, setCallNotice] = useState('');
    const [lines, setLines] = useState<PhoneCallLine[]>([]);
    const [offer, setOffer] = useState<PhoneOffer | null>(null);
    const [history, setHistory] = useState<readonly PhoneCallRecord[] | null>(null);
    const [locations, setLocations] = useState<Readonly<Record<number, PhoneContactLocation>>>({});
    const pendingAction = useRef(0);
    // The handlers read the current call and offer from refs, so every state update stays a pure function.
    const callRef = useRef<PhoneCall | null>(null);
    const offerRef = useRef<PhoneOffer | null>(null);

    useMessageEvent<RpPhoneStatusEvent>(RpPhoneStatusEvent, useCallback(event =>
    {
        const parser = event.getParser();
        setStatus({ hasSim: parser.hasSim, number: parser.number, load: parser.load, hospitalNumber: parser.hospitalNumber, policeNumber: parser.policeNumber,
            messageCost: parser.messageCost, callCost: parser.callCost, callPeriodSeconds: parser.callPeriodSeconds, shareLocation: parser.shareLocation });
        if(!parser.hasSim) setHistory(null);
        // Replies to the player's own action and pushes after a purchase carry a line to show.
        if(parser.message && (parser.requestId === 0 || parser.requestId === pendingAction.current)) setNotice({ text: parser.message, refused: parser.refused });
    }, []));

    useMessageEvent<RpPhoneCallEvent>(RpPhoneCallEvent, useCallback(event =>
    {
        const parser = event.getParser();
        const previous = callRef.current;
        if(parser.state === CallState.Idle)
        {
            callRef.current = null;
            setCall(null);
            setLines([]);
            setCallNotice(parser.notice);
            return;
        }
        if(previous?.callId !== parser.callId) setLines([]);
        const connectedAt = parser.state === CallState.Active
            ? (previous?.callId === parser.callId && previous.state === CallState.Active ? previous.connectedAt : performance.now() - parser.seconds * 1000)
            : 0;
        const next = { state: parser.state, callId: parser.callId, peerName: parser.peerName, peerNumber: parser.peerNumber, connectedAt };
        callRef.current = next;
        setCall(next);
        setCallNotice('');
    }, []));

    useMessageEvent<RpPhoneCallLineEvent>(RpPhoneCallLineEvent, useCallback(event =>
    {
        const parser = event.getParser();
        if(callRef.current?.callId !== parser.callId) return;
        setLines(previous => [...previous.slice(-49), { fromSelf: parser.fromSelf, speaker: parser.speaker, text: parser.text }]);
    }, []));

    useMessageEvent<RpPhoneOfferEvent>(RpPhoneOfferEvent, useCallback(event =>
    {
        const parser = event.getParser();
        if(parser.state === 0)
        {
            if(offerRef.current?.offerId !== parser.offerId) return;
            offerRef.current = null;
        }
        else offerRef.current = { offerId: parser.offerId, item: parser.item, amount: parser.amount, price: parser.price, seller: parser.seller,
            expiresAt: performance.now() + parser.expiresInMs };
        setOffer(offerRef.current);
    }, []));

    useMessageEvent<RpPhoneHistoryEvent>(RpPhoneHistoryEvent, useCallback(event =>
    {
        setHistory(event.getParser().calls);
    }, []));

    useMessageEvent<RpPhoneLocationEvent>(RpPhoneLocationEvent, useCallback(event =>
    {
        const parser = event.getParser();
        setLocations(previous => ({ ...previous, [parser.userId]: { state: parser.state, roomName: parser.roomName, message: parser.message } }));
    }, []));

    const request = useCallback((action: number, value = '') =>
    {
        const requestId = allocateRequestId();
        if(action !== PhoneAction.Status) pendingAction.current = requestId;
        if(!send(() => new RpPhoneRequestComposer(requestId, action, value))) setNotice({ text: 'That could not be sent.', refused: true });
    }, []);

    // Reads change no state until their reply arrives.
    const read = useCallback((action: number, value = '') =>
    {
        send(() => new RpPhoneRequestComposer(allocateRequestId(), action, value));
    }, []);

    // Reading the status changes no state here; its reply arrives as a 6100 event.
    useEffect(() =>
    {
        if(authenticated) send(() => new RpPhoneRequestComposer(allocateRequestId(), PhoneAction.Status, ''));
    }, [authenticated]);

    const callAction = useCallback((action: number, number = '') =>
    {
        setCallNotice('');
        if(!send(() => new RpPhoneCallActionComposer(action, number))) setCallNotice('That could not be sent.');
    }, []);

    const respondOffer = useCallback((accepted: boolean) =>
    {
        const current = offerRef.current;
        if(!current) return;
        offerRef.current = null;
        setOffer(null);
        send(() => new RpPhoneOfferResponseComposer(current.offerId, accepted ? 1 : 0));
    }, []);

    return {
        status: authenticated ? status : null,
        notice,
        clearNotice: useCallback(() => setNotice(null), []),
        call: authenticated ? call : null,
        callNotice,
        clearCallNotice: useCallback(() => setCallNotice(''), []),
        lines,
        offer: authenticated ? offer : null,
        refresh: useCallback(() => request(PhoneAction.Status), [request]),
        factoryReset: useCallback((confirmation: string) => request(PhoneAction.Reset, confirmation), [request]),
        addContact: useCallback((number: string) => request(PhoneAction.AddContact, number), [request]),
        dial: useCallback((number: string) => callAction(CallAction.Dial, number), [callAction]),
        answer: useCallback(() => callAction(CallAction.Answer), [callAction]),
        hangUp: useCallback(() => callAction(CallAction.HangUp), [callAction]),
        callContact: useCallback((userId: number) => callAction(CallAction.CallContact, String(userId)), [callAction]),
        history: authenticated ? history : null,
        loadHistory: useCallback(() => read(PhoneAction.History), [read]),
        locations: authenticated ? locations : NO_LOCATIONS,
        locate: useCallback((userId: number) => read(PhoneAction.Locate, String(userId)), [read]),
        setSharing: useCallback((share: boolean) => request(PhoneAction.ShareLocation, share ? '1' : '0'), [request]),
        respondOffer
    };
};

export const useRpPhone = () => useSharedHook(useRpPhoneSource);
registerSharedHook(useRpPhoneSource);
