import { useEffect, useRef } from 'react';
import { RadioChannel, RadioTransmission, useRpRadio } from './useRpRadio';

/** Chat style reserved for radio lines; no native chatstyle uses it. */
export const DISTRICT_RADIO_STYLE = 900;

/** `[100.1] Marco`, `[Hospital] Doctor Ann`, `[Gang] Boss teniser`: the tag says where it was heard. */
export const radioChatName = (message: RadioTransmission) =>
{
    const tag = message.channel === RadioChannel.Hospital ? 'Hospital'
        : message.channel === RadioChannel.Gang ? 'Gang'
            : (message.frequency / 10).toFixed(1);
    const name = message.senderRank ? `${ message.senderRank } ${ message.senderName }` : message.senderName;

    return `[${ tag }] ${ name }`;
};

/**
 * Calls onLine once for every transmission that arrives after mount. Traffic already in the feed is not replayed,
 * and the feed restarting its ids (sign-out or another account) starts counting again from zero.
 */
export const useRadioChatLines = (onLine: (message: RadioTransmission) => void) =>
{
    const { messages } = useRpRadio();
    const lastSeen = useRef<number | null>(null);
    const handler = useRef(onLine);

    useEffect(() =>
    {
        handler.current = onLine;
    });

    useEffect(() =>
    {
        const latest = messages.length ? messages[messages.length - 1].id : 0;

        if(lastSeen.current === null)
        {
            lastSeen.current = latest;
            return;
        }

        if(latest < lastSeen.current) lastSeen.current = 0;

        for(const message of messages) if(message.id > lastSeen.current) handler.current(message);

        lastSeen.current = latest;
    }, [ messages ]);
};
