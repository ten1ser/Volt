import { RpBusinessEvent, RpBusinessRequestComposer, RpBusinessSnapshot } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';

let nextRequestId = 0;
const allocateRequestId = () =>
{
    nextRequestId = nextRequestId % 2147483647 + 1;
    return nextRequestId;
};
export type BusinessQuery = { page: number; rankFilter: number; search: string };

export const useRpBusiness = (open: boolean, query: BusinessQuery) =>
{
    const { authenticated } = useConnectionState();
    const [snapshot, setSnapshot] = useState<RpBusinessSnapshot | null>(null);
    const [pending, setPending] = useState(false);
    const [mutating, setMutating] = useState(false);
    const [error, setError] = useState('');
    const [receivedAt, setReceivedAt] = useState(0);
    const [now, setNow] = useState(0);
    const [context, setContext] = useState({ open, authenticated, ...query });
    const active = useRef(false);
    const currentQuery = useRef(query);
    const outstanding = useRef<{ id: number; timer: number } | null>(null);
    const hasError = useRef(false);
    if(context.open !== open || context.authenticated !== authenticated || context.page !== query.page || context.rankFilter !== query.rankFilter || context.search !== query.search)
    {
        if(context.open !== open || context.authenticated !== authenticated) setSnapshot(null);
        setContext({ open, authenticated, ...query });
        setPending(open && authenticated);
        setMutating(false);
        setError('');
    }

    const invalidate = useCallback(() =>
    {
        if(outstanding.current) window.clearTimeout(outstanding.current.timer);
        outstanding.current = null;
    }, []);

    const request = useCallback((action = 0, target = 0, level = 0) =>
    {
        if(!active.current || document.hidden || outstanding.current) return;
        const id = allocateRequestId();
        setPending(true);
        setMutating(action !== 0);
        setError('');
        hasError.current = false;
        const fail = () =>
        {
            if(outstanding.current?.id !== id) return;
            invalidate();
            setPending(false);
            setMutating(false);
            hasError.current = true;
            setError(action === 0 ? 'No response from the business. Refresh to try again.' : 'The result could not be confirmed. Refresh before trying the action again.');
        };
        outstanding.current = { id, timer: window.setTimeout(fail, 10000) };
        const filter = currentQuery.current;
        try
        {
            SendMessageComposer(new RpBusinessRequestComposer(id, action, target, level, filter.page, filter.rankFilter, filter.search.trim()));
        }
        catch
        {
            fail();
        }
    }, [invalidate]);

    useMessageEvent<RpBusinessEvent>(RpBusinessEvent, useCallback(event =>
    {
        const parser = event.getParser();
        if(!active.current || outstanding.current?.id !== parser.requestId || !parser.snapshot) return;
        invalidate();
        setPending(false);
        setMutating(false);
        setError('');
        hasError.current = false;
        setSnapshot(parser.snapshot);
        const stamp = performance.now();
        setReceivedAt(stamp);
        setNow(stamp);
    }, [invalidate]));

    useEffect(() =>
    {
        invalidate();
        active.current = open && authenticated;
        currentQuery.current = { page: query.page, rankFilter: query.rankFilter, search: query.search };
        hasError.current = false;
        if(!open || !authenticated) return;
        const initial = window.setTimeout(() => request(), 300);
        const poll = window.setInterval(() =>
        {
            if(!hasError.current) request();
        }, 5000);
        const tick = window.setInterval(() => setNow(performance.now()), 1000);
        const visible = () =>
        {
            if(!document.hidden && !hasError.current) request();
        };
        document.addEventListener('visibilitychange', visible);
        return () =>
        {
            active.current = false;
            invalidate();
            window.clearTimeout(initial);
            window.clearInterval(poll);
            window.clearInterval(tick);
            document.removeEventListener('visibilitychange', visible);
        };
    }, [open, authenticated, query.page, query.rankFilter, query.search, request, invalidate]);

    const remainingMs = snapshot?.self.onDuty ? Math.max(0, snapshot.self.remainingMs - Math.max(0, now - receivedAt)) : 0;
    return { snapshot: open && authenticated ? snapshot : null, pending, mutating, error, remainingMs,
        refresh: () => request(), act: (action: number, target = 0, level = 0) => request(action, target, level), authenticated };
};
