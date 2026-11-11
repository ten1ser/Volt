import { RoomObjectCategory } from '@volt/renderer';
import { FC, useEffect, useRef } from 'react';
import { AddAnimationTickerCallback, GetRoomObjectBounds } from '../../../api';
import { RpRoomEffect, useRpRoomEffects } from '../../../hooks/roleplay/useRpRoomEffects';
import { useRoom } from '../../../hooks/rooms/useRoom';
import './RoomEffectsView.scss';

/** 0 punch hit, 1 punch miss, 2 shot hit, 3 shot miss, 4 armor break, 5 knockout, 6 heal, 7 robbed. */
export const ROOM_EFFECT_STEMS = ['punch-hit', 'punch-miss', 'shot-hit', 'shot-miss', 'armor-break', 'knockout', 'heal', 'robbed'];

export const roomEffectAmountText = (kind: number, amount: number): { text: string; tone: 'damage' | 'heal' | 'coins' } | null =>
{
    if(amount <= 0) return null;
    if(kind === 0 || kind === 2) return { text: `-${ amount }`, tone: 'damage' };
    if(kind === 6) return { text: `+${ amount }`, tone: 'heal' };
    if(kind === 7) return { text: `-$${ amount }`, tone: 'coins' };
    return null;
};

interface RoomEffectViewProps
{
    roomId: number;
    effect: RpRoomEffect;
}

/** One effect sprite on an avatar's feet, with its floating number above the head. */
const RoomEffectView: FC<RoomEffectViewProps> = ({ roomId, effect }) =>
{
    const elementRef = useRef<HTMLDivElement>(null);
    const amountRef = useRef<HTMLDivElement>(null);
    const { kind, targetVirtualId, amount } = effect;
    const amountText = roomEffectAmountText(kind, amount);

    useEffect(() =>
    {
        const updatePosition = () =>
        {
            const element = elementRef.current;

            if(!element) return;

            const bounds = GetRoomObjectBounds(roomId, targetVirtualId, RoomObjectCategory.UNIT, 1);

            if(!bounds)
            {
                element.style.visibility = 'hidden';
                return;
            }

            element.style.visibility = 'visible';
            element.style.left = `${ Math.round(bounds.left + bounds.width / 2) }px`;
            element.style.top = `${ Math.round(bounds.top + bounds.height) }px`;
            element.style.setProperty('--rp-fx-scale', `${ Math.max(0.5, Math.round(bounds.height / 88 * 2) / 2) }`);

            if(amountRef.current) amountRef.current.style.top = `${ bounds.top - (bounds.top + bounds.height) }px`;
        };

        updatePosition();

        return AddAnimationTickerCallback(updatePosition);
    }, [roomId, targetVirtualId]);

    return (
        <div ref={elementRef} className={`rp-room-effect rp-room-effect--${ ROOM_EFFECT_STEMS[kind] }`} style={{ visibility: 'hidden' }}>
            <div className="rp-room-effect__sprite" />
            {amountText && (
                <div ref={amountRef} className={`rp-room-effect__amount rp-room-effect__amount--${ amountText.tone }`}>{amountText.text}</div>
            )}
        </div>
    );
};

/** Draws the room-wide effect sprites (packet 6140) positioned over their target avatar. */
export const RoomEffectsView: FC<{}> = () =>
{
    const { roomSession = null } = useRoom();
    const effects = useRpRoomEffects();

    if(!roomSession || !effects.length) return null;

    return (
        <div className="rp-room-effects">
            {effects.map((effect) =>
            {
                if(!ROOM_EFFECT_STEMS[effect.kind]) return null;
                return <RoomEffectView key={effect.id} roomId={roomSession.roomId} effect={effect} />;
            })}
        </div>
    );
};
