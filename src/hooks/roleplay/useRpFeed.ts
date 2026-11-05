import { RpActionProgressEvent, RpFeedLineEvent } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessageEvent } from '../events/useMessageEvent';

/** 0 shot kill, 1 melee kill, 2 wanted, 3 bounty, 4 arrested (6130). */
export interface RpFeedLine
{
    id: number;
    kind: number;
    actorName: string;
    targetName: string;
    detail: string;
}

/** 0 pistol reload, 1 pickpocket (6131). The id restarts the bar's animation when the same kind starts again. */
export interface RpActionProgress
{
    id: number;
    kind: number;
    durationMs: number;
}

export const FEED_MAX_LINES = 6;
export const FEED_LINE_MS = 15000;
// The server hides the bar when an action ends; this only covers a hide that never arrives.
const PROGRESS_GRACE_MS = 500;

/** The city-wide roleplay log (newest last, each line for 15 s) and the own action progress bar. */
export const useRpFeed = () =>
{
    const [lines, setLines] = useState<RpFeedLine[]>([]);
    const [progress, setProgress] = useState<RpActionProgress | null>(null);
    const nextId = useRef(0);
    const lineTimers = useRef(new Set<number>());
    const progressTimer = useRef(0);

    useMessageEvent<RpFeedLineEvent>(RpFeedLineEvent, useCallback(event =>
    {
        const parser = event.getParser();
        const line = { id: ++nextId.current, kind: parser.kind, actorName: parser.actorName, targetName: parser.targetName, detail: parser.detail };
        setLines(previous => [...previous.slice(-(FEED_MAX_LINES - 1)), line]);
        const timer = window.setTimeout(() =>
        {
            lineTimers.current.delete(timer);
            setLines(previous => previous.filter(entry => entry.id !== line.id));
        }, FEED_LINE_MS);
        lineTimers.current.add(timer);
    }, []));

    useMessageEvent<RpActionProgressEvent>(RpActionProgressEvent, useCallback(event =>
    {
        const { kind, durationMs } = event.getParser();
        if(!durationMs)
        {
            setProgress(current => (current?.kind === kind ? null : current));
            return;
        }
        const id = ++nextId.current;
        setProgress({ id, kind, durationMs });
        window.clearTimeout(progressTimer.current);
        progressTimer.current = window.setTimeout(() => setProgress(current => (current?.id === id ? null : current)), durationMs + PROGRESS_GRACE_MS);
    }, []));

    useEffect(() =>
    {
        const timers = lineTimers.current;
        return () =>
        {
            for(const timer of timers) window.clearTimeout(timer);
            window.clearTimeout(progressTimer.current);
        };
    }, []);

    return { lines, progress };
};
