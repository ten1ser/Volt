import { RpHealOfferEvent, RpHealResponseComposer } from '@volt/renderer';
import { useEffect, useId, useRef, useState } from 'react';
import { SendMessageComposer } from '../../../api';
import { VoltCardHeaderView, VoltCardView } from '../../../common';
import { useMessageEvent } from '../../../hooks';
import { useConnectionState } from '../../../hooks/events/useConnectionState';
import { useActiveRoomSessionSnapshot } from '../../../hooks/session/useSessionSnapshots';
import './HealOfferView.scss';

type Offer = { id: string; healerName: string; price: number; expiresInMs: number; roomId: number };

export const HealOfferView = () =>
{
    const { authenticated } = useConnectionState();
    const room = useActiveRoomSessionSnapshot();
    const [offer, setOffer] = useState<Offer | null>(null);
    const [error, setError] = useState('');
    const sent = useRef(false);
    const panel = useRef<HTMLDivElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const id = useId();

    // Retire local consent as soon as its room/session context goes away.
    if(offer && (!authenticated || room?.roomId !== offer.roomId)) setOffer(null);

    useMessageEvent<RpHealOfferEvent>(RpHealOfferEvent, event =>
    {
        const parser = event.getParser();
        if(parser.state === 0)
        {
            setOffer(current => current?.id === parser.offerId ? null : current);
            return;
        }
        if(!authenticated || !room || parser.state !== 1 || parser.price !== 5) return;
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        sent.current = false;
        setError('');
        setOffer({ id: parser.offerId, healerName: parser.healerName, price: parser.price,
            expiresInMs: parser.expiresInMs, roomId: room.roomId });
    });

    const respond = (accepted: number) =>
    {
        if(!offer || sent.current) return;
        sent.current = true;
        try
        {
            SendMessageComposer(new RpHealResponseComposer(offer.id, accepted));
            setOffer(null);
        }
        catch
        {
            setError('Your response could not be sent. Close this window and try again.');
        }
    };

    const decline = () =>
    {
        if(!sent.current) respond(0);
        setOffer(null);
    };

    useEffect(() =>
    {
        if(!offer) return;
        const focus = window.setTimeout(() => panel.current?.querySelector<HTMLButtonElement>('.heal-offer-no')?.focus(), 0);
        const expiry = window.setTimeout(() =>
        {
            if(!sent.current)
            {
                sent.current = true;
                try
                {
                    SendMessageComposer(new RpHealResponseComposer(offer.id, 0));
                }
                catch
                { /* The server also expires every offer; expiry can never accept a charge. */ }
            }
            setOffer(current => current?.id === offer.id ? null : current);
        }, offer.expiresInMs);
        return () =>
        {
            window.clearTimeout(focus);
            window.clearTimeout(expiry);
            if(opener.current?.isConnected) opener.current.focus();
        };
    }, [offer]);

    if(!offer || !authenticated || room?.roomId !== offer.roomId) return null;
    return <VoltCardView theme="district" uniqueKey="hospital-heal-offer" className="district-heal-offer" isResizable={false} constrainToViewport
        role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onKeyDown={event =>
        {
            if(event.key === 'Escape')
            {
                event.preventDefault(); event.stopPropagation(); decline();
            }
        }}>
        <VoltCardHeaderView headerText="Get healed?" onCloseClick={decline} />
        <div ref={panel} className="heal-offer-body">
            <h2 id={`${id}-title`}>Get healed?</h2>
            <p id={`${id}-description`}><strong>{offer.healerName}</strong> offers to restore your Health to <strong>100 HP</strong> for <strong>{offer.price} RP Coins</strong>.</p>
            <p className="heal-offer-note">You only pay if you choose Yes and the treatment succeeds.</p>
            {error && <p role="alert">{error}</p>}
            <div className="heal-offer-actions">
                <button className="heal-offer-no" type="button" onClick={decline}>No</button>
                <button className="heal-offer-yes" type="button" disabled={!!error} onClick={() => respond(1)}>Yes — {offer.price}c</button>
            </div>
        </div>
    </VoltCardView>;
};
