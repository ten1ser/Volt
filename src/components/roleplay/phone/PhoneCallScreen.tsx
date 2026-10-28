import { FC, useEffect, useState } from 'react';
import { CallState, PhoneCall, PhoneCallLine, PhoneOffer } from '../../../hooks/roleplay/useRpPhone';

const elapsed = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const useNow = (active: boolean) =>
{
    const [now, setNow] = useState(() => performance.now());

    useEffect(() =>
    {
        if (!active) return;
        const timer = window.setInterval(() => setNow(performance.now()), 1000);
        return () => window.clearInterval(timer);
    }, [active]);

    return now;
};

/** Full-screen call UI inside the phone: incoming (answer or decline), dialing (cancel) and connected (timer, lines, hang up). */
export const PhoneCallScreen: FC<{ call: PhoneCall; lines: PhoneCallLine[]; onAnswer: () => void; onHangUp: () => void }> = ({ call, lines, onAnswer, onHangUp }) =>
{
    const now = useNow(call.state === CallState.Active);
    const seconds = call.state === CallState.Active ? Math.max(0, Math.floor((now - call.connectedAt) / 1000)) : 0;
    const caption = call.state === CallState.Incoming ? 'Incoming call' : call.state === CallState.Dialing ? 'Calling…' : elapsed(seconds);

    return (
        <div className={`district-phone__call is-state-${call.state}`} role="dialog" aria-label={`Call with ${call.peerName}`}>
            <div className="district-phone__call-who">
                <span className="district-phone__call-avatar" aria-hidden="true">{(call.peerName || '?').charAt(0).toUpperCase()}</span>
                <strong>{call.peerName}</strong>
                <small>{call.peerNumber}</small>
                <span className="district-phone__call-caption" role="status">{caption}</span>
            </div>
            {call.state === CallState.Active && (
                <>
                    <ol className="district-phone__call-lines" aria-label="Call transcript">
                        {lines.map((line, index) => <li key={index} className={line.fromSelf ? 'is-self' : ''}><b>{line.fromSelf ? 'You' : line.speaker}</b> {line.text}</li>)}
                        {!lines.length && <li className="district-phone__call-hint">Talk in the room chat. While you are on the call, only {call.peerName} hears you.</li>}
                    </ol>
                </>
            )}
            <div className="district-phone__call-actions">
                {call.state === CallState.Incoming && <button type="button" className="district-phone__call-button is-call" aria-label="Answer" onClick={onAnswer}>✆</button>}
                <button type="button" className="district-phone__call-button is-end" aria-label={call.state === CallState.Incoming ? 'Decline' : 'Hang up'} onClick={onHangUp}>✆</button>
            </div>
        </div>
    );
};

/** A staff sale offer shown over the phone: buy or decline before it runs out. */
export const PhoneOfferSheet: FC<{ offer: PhoneOffer; onRespond: (accepted: boolean) => void }> = ({ offer, onRespond }) =>
{
    const now = useNow(true);
    const left = Math.max(0, Math.ceil((offer.expiresAt - now) / 1000));
    const what = offer.item === 'sim' ? `a SIM card with ${offer.amount} Load` : `${offer.amount} Load`;

    return (
        <div className="district-phone__offer" role="alertdialog" aria-label="Purchase offer">
            <strong>{offer.seller} is selling you {what}</strong>
            <span>for {offer.price} coins · {left}s</span>
            <div className="district-phone__offer-actions">
                <button type="button" className="district-phone__pill is-primary" onClick={() => onRespond(true)}>Buy for {offer.price}c</button>
                <button type="button" className="district-phone__pill" onClick={() => onRespond(false)}>No thanks</button>
            </div>
        </div>
    );
};
