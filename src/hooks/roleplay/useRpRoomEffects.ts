import { RpRoomEffectEvent } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessageEvent } from '../events/useMessageEvent';

/** 6140: one visual effect over a room avatar, for everyone in the room. */
export interface RpRoomEffect
{
    id: number;
    kind: number;
    targetVirtualId: number;
    sourceVirtualId: number;
    amount: number;
}

export const ROOM_EFFECT_MAX = 24;
export const roomEffectLifetimeMs = (kind: number): number => kind === 5 ? 2600 : 1200;

/** The room's short-lived effect sprites, newest last, each removed once its animation has played. */
export const useRpRoomEffects = (): RpRoomEffect[] =>
{
    const [effects, setEffects] = useState<RpRoomEffect[]>([]);
    const nextId = useRef(0);
    const timers = useRef(new Set<number>());

    useMessageEvent<RpRoomEffectEvent>(RpRoomEffectEvent, useCallback(event =>
    {
        const parser = event.getParser();
        const effect = { id: ++nextId.current, kind: parser.kind, targetVirtualId: parser.targetVirtualId, sourceVirtualId: parser.sourceVirtualId, amount: parser.amount };
        setEffects(previous => [...previous.slice(-(ROOM_EFFECT_MAX - 1)), effect]);
        const timer = window.setTimeout(() =>
        {
            timers.current.delete(timer);
            setEffects(previous => previous.filter(entry => entry.id !== effect.id));
        }, roomEffectLifetimeMs(effect.kind));
        timers.current.add(timer);
    }, []));

    useEffect(() =>
    {
        const activeTimers = timers.current;
        return () =>
        {
            for(const timer of activeTimers) window.clearTimeout(timer);
        };
    }, []);

    return effects;
};
