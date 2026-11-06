import { RpProfileEvent, RpProfileRequestComposer } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';
import { allocateRpProfileRequestId } from './useRpProfile';

export interface PlayerCardAffiliations
{
    loading: boolean;
    unavailable: boolean;
    job: string;
    jobBadge: string;
    gang: string;
    gangBadge: string;
    gangRank: string;
    onDuty: boolean;
    rank: string;
    kills: number;
    deaths: number;
    punchesThrown: number;
    punchesMissed: number;
    punchesReceived: number;
    timesJailed: number;
}

export const PLAYER_CARD_AFFILIATION_TIMEOUT_MS = 5000;

const NO_STATS = { gangRank: '', onDuty: false, rank: '', kills: 0, deaths: 0, punchesThrown: 0, punchesMissed: 0, punchesReceived: 0, timesJailed: 0 };

const EMPTY: PlayerCardAffiliations = { loading: false, unavailable: false, job: '', jobBadge: '', gang: '', gangBadge: '', ...NO_STATS };
const LOADING: PlayerCardAffiliations = { loading: true, unavailable: false, job: '', jobBadge: '', gang: '', gangBadge: '', ...NO_STATS };
const UNAVAILABLE: PlayerCardAffiliations = { loading: false, unavailable: true, job: '', jobBadge: '', gang: '', gangBadge: '', ...NO_STATS };

/**
 * The two authoritative affiliations on the docked player card. It reads packet 6090 directly for one user without opening
 * the native profile window, keeps requests correlated by id and user, and never infers affiliations from equipped groups.
 */
export const usePlayerCardAffiliations = (userId: number): PlayerCardAffiliations =>
{
    const { authenticated } = useConnectionState();
    const [result, setResult] = useState<{ userId: number; data: PlayerCardAffiliations }>({ userId: 0, data: EMPTY });
    const pending = useRef({ requestId: 0, userId: 0 });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stop = useCallback(() =>
    {
        pending.current = { requestId: 0, userId: 0 };

        if(timer.current !== null)
        {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    useMessageEvent<RpProfileEvent>(RpProfileEvent, useCallback(event =>
    {
        const parser = event.getParser();

        if(!authenticated || pending.current.requestId <= 0) return;
        if(!parser || parser.requestId !== pending.current.requestId || parser.userId !== pending.current.userId || parser.userId !== userId) return;

        stop();

        setResult({
            userId,
            data: parser.available
                ? {
                    loading: false,
                    unavailable: false,
                    job: parser.job,
                    jobBadge: parser.jobBadge,
                    gang: parser.gang,
                    gangBadge: parser.gangBadge,
                    gangRank: parser.gangRank,
                    onDuty: parser.onDuty,
                    rank: parser.rank,
                    kills: parser.kills,
                    deaths: parser.deaths,
                    punchesThrown: parser.punchesThrown,
                    punchesMissed: parser.punchesMissed,
                    punchesReceived: parser.punchesReceived,
                    timesJailed: parser.timesJailed
                }
                : UNAVAILABLE
        });
    }, [authenticated, stop, userId]));

    useEffect(() =>
    {
        stop();

        if(!authenticated || !Number.isSafeInteger(userId) || userId <= 0)
        {
            setResult({ userId: 0, data: EMPTY });
            return;
        }

        const requestId = allocateRpProfileRequestId();

        pending.current = { requestId, userId };
        setResult({ userId, data: LOADING });

        try
        {
            SendMessageComposer(new RpProfileRequestComposer(requestId, userId));
        }
        catch
        {
            stop();
            setResult({ userId, data: UNAVAILABLE });
            return;
        }

        timer.current = setTimeout(() =>
        {
            if(pending.current.requestId !== requestId || pending.current.userId !== userId) return;

            stop();
            setResult({ userId, data: UNAVAILABLE });
        }, PLAYER_CARD_AFFILIATION_TIMEOUT_MS);

        return stop;
    }, [authenticated, userId, stop]);

    // Logout or an invalid id must not expose the previous user's badges, even before the passive effect clears them.
    if(!authenticated || !Number.isSafeInteger(userId) || userId <= 0) return EMPTY;
    // A changed id renders as loading straight away, so old badges never flash under the new card.
    if(result.userId !== userId) return LOADING;

    return result.data;
};
