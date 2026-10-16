import { RpStatsEvent, RpStatsRequestComposer } from '@volt/renderer';
import { useCallback, useEffect, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';

export type RpStats = { health: number; energy: number };

export const useRpStats = (): RpStats | null =>
{
    const [stats, setStats] = useState<RpStats | null>(null);
    const { authenticated } = useConnectionState();
    const receive = useCallback((event: RpStatsEvent) =>
    {
        const parser = event.getParser();
        setStats({ health: parser.health, energy: parser.energy });
    }, []);

    useMessageEvent<RpStatsEvent>(RpStatsEvent, receive);

    useEffect(() =>
    {
        if(!authenticated) return;
        const refresh = () => SendMessageComposer(new RpStatsRequestComposer());
        refresh();
        // Server changes push immediately; periodic snapshots also recover external database changes.
        const timer = window.setInterval(refresh, 15000);
        return () => window.clearInterval(timer);
    }, [authenticated]);

    return authenticated ? stats : null;
};
