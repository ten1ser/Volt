import { RpGangEvent, RpGangRequestComposer, RpGangSnapshot } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';

export const GangAction = {
    Read: 0, Search: 1, Create: 2, RequestJoin: 3, CancelRequest: 4, Accept: 5, Decline: 6, Kick: 7, SetRank: 8, CreateRank: 9,
    RenameRank: 10, SetRankManage: 11, DeleteRank: 12, MoveRank: 13, TransferLeadership: 14, Leave: 15, Disband: 16, Edit: 17
} as const;

let nextRequestId = 0;
const allocateRequestId = () =>
{
    nextRequestId = nextRequestId % 2147483647 + 1;
    return nextRequestId;
};

export type GangQuery = { viewId: number; search: string };
export type GangRequestOptions = { gangId?: number; target?: number; rank?: number; value?: string };

/**
 * Packet 6110 while the gang window is open: one request at a time, a correlated reply, a poll every five seconds and
 * no automatic retry of an action whose result was not confirmed.
 */
export const useRpGang = (open: boolean, query: GangQuery) =>
{
    const { authenticated } = useConnectionState();
    const [snapshot, setSnapshot] = useState<RpGangSnapshot | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [context, setContext] = useState({ open, authenticated });
    const active = useRef(false);
    const currentQuery = useRef(query);
    const outstanding = useRef<{ id: number; timer: number } | null>(null);
    const hasError = useRef(false);
    const landing = useRef(true);
    if(context.open !== open || context.authenticated !== authenticated)
    {
        setSnapshot(null);
        setContext({ open, authenticated });
        setPending(open && authenticated);
        setError('');
    }
    useEffect(() =>
    {
        currentQuery.current = query;
    });

    const invalidate = useCallback(() =>
    {
        if(outstanding.current) window.clearTimeout(outstanding.current.timer);
        outstanding.current = null;
    }, []);

    const request = useCallback((action: number, options: GangRequestOptions = {}) =>
    {
        if(!active.current || outstanding.current) return false;
        const id = allocateRequestId();
        const read = action === GangAction.Read || action === GangAction.Search;
        setPending(true);
        setError('');
        hasError.current = false;
        const fail = () =>
        {
            if(outstanding.current?.id !== id) return;
            invalidate();
            setPending(false);
            hasError.current = true;
            setError(read ? 'No response from the server. Refresh to try again.' : 'The result could not be confirmed. Refresh before trying again.');
        };
        outstanding.current = { id, timer: window.setTimeout(fail, 10000) };
        try
        {
            SendMessageComposer(new RpGangRequestComposer(id, action, options.gangId ?? 0, options.target ?? 0, options.rank ?? 0, options.value ?? ''));
        }
        catch
        {
            fail();
        }
        return true;
    }, [invalidate]);

    const read = useCallback(() =>
    {
        if(document.hidden) return;
        const { viewId, search } = currentQuery.current;
        // Without a gang the landing page lists gangs, so a refresh repeats the search.
        if(viewId === 0 && landing.current) request(GangAction.Search, { value: search.trim() });
        else request(GangAction.Read, { gangId: viewId });
    }, [request]);

    useMessageEvent<RpGangEvent>(RpGangEvent, useCallback(event =>
    {
        const parser = event.getParser();
        if(!active.current || outstanding.current?.id !== parser.requestId || !parser.snapshot) return;
        invalidate();
        setPending(false);
        setError('');
        hasError.current = false;
        landing.current = parser.snapshot.myGangId === 0;
        setSnapshot(parser.snapshot);
    }, [invalidate]));

    useEffect(() =>
    {
        invalidate();
        active.current = open && authenticated;
        hasError.current = false;
        if(!open || !authenticated) return;
        const initial = window.setTimeout(read, 150);
        const poll = window.setInterval(() =>
        {
            if(!hasError.current) read();
        }, 5000);
        const visible = () =>
        {
            if(!document.hidden && !hasError.current) read();
        };
        document.addEventListener('visibilitychange', visible);
        return () =>
        {
            active.current = false;
            invalidate();
            window.clearTimeout(initial);
            window.clearInterval(poll);
            document.removeEventListener('visibilitychange', visible);
        };
    }, [open, authenticated, query.viewId, read, invalidate]);

    return { snapshot: open && authenticated ? snapshot : null, pending, error, authenticated, refresh: read,
        act: (action: number, options: GangRequestOptions = {}) => request(action, options) };
};
