import { RpCityEvent, RpCityRequestComposer } from '@volt/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { registerSharedHook, useSharedHook } from '../../state/useSharedHook';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';
import { cityClock, CitySnapshot } from './cityClock';

export const useCityStatusSource = () =>
{
    const { authenticated } = useConnectionState();
    const [sample, setSample] = useState<{ snapshot: CitySnapshot; at: number } | null>(null);
    const [now, setNow] = useState(0);
    const [previouslyAuthenticated, setPreviouslyAuthenticated] = useState(authenticated);
    if(previouslyAuthenticated !== authenticated)
    {
        setPreviouslyAuthenticated(authenticated);
        setSample(null);
    }
    const requestedAt = useRef<number | null>(null);
    const receive = useCallback((event: RpCityEvent) =>
    {
        const parser = event.getParser();
        const at = performance.now();
        const latency = requestedAt.current === null ? 0 : Math.min(2000, Math.max(0, at - requestedAt.current)) / 2;
        setSample({ snapshot: { cycleElapsedMs: (parser.cycleElapsedMs + latency) % parser.cycleDurationMs,
            cycleDurationMs: parser.cycleDurationMs, dayDurationMs: parser.dayDurationMs, onlinePlayers: parser.onlinePlayers }, at });
        setNow(at);
        requestedAt.current = null;
    }, []);
    useMessageEvent<RpCityEvent>(RpCityEvent, receive);

    useEffect(() =>
    {
        if(!authenticated)
        {
            requestedAt.current = null;
            return;
        }
        const refresh = () =>
        {
            requestedAt.current = performance.now();
            SendMessageComposer(new RpCityRequestComposer());
        };
        refresh();
        const poll = window.setInterval(refresh, 15000);
        const tick = window.setInterval(() => setNow(performance.now()), 250);
        const resume = () =>
        {
            if(document.visibilityState === 'visible') refresh();
        };
        document.addEventListener('visibilitychange', resume);
        return () =>
        {
            window.clearInterval(poll);
            window.clearInterval(tick);
            document.removeEventListener('visibilitychange', resume);
        };
    }, [authenticated]);

    return { city: authenticated && sample ? cityClock(sample.snapshot, now - sample.at) : null };
};

export const useCityStatus = () => useSharedHook(useCityStatusSource);
registerSharedHook(useCityStatusSource);
