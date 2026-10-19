import { RpHospitalTreatmentEvent, RpHospitalTreatmentRequestComposer } from '@volt/renderer';
import { useCallback, useEffect, useState } from 'react';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';

export type RpHospitalTreatment = { phase: 0 | 1 | 2; progress: number; remainingMs: number };

export const useRpHospitalTreatment = (): RpHospitalTreatment | null =>
{
    const [treatment, setTreatment] = useState<RpHospitalTreatment | null>(null);
    const { authenticated } = useConnectionState();
    const receive = useCallback((event: RpHospitalTreatmentEvent) =>
    {
        const parser = event.getParser();
        setTreatment({ phase: parser.phase as RpHospitalTreatment['phase'], progress: parser.progress, remainingMs: parser.remainingMs });
    }, []);

    useMessageEvent<RpHospitalTreatmentEvent>(RpHospitalTreatmentEvent, receive);

    useEffect(() =>
    {
        // Never carry a previous session's status into a new authentication.
        setTreatment(null);
        if(!authenticated) return;
        const refresh = () => SendMessageComposer(new RpHospitalTreatmentRequestComposer());
        refresh();
        // Server pushes on phase changes and treatment ticks; the poll recovers missed snapshots.
        const timer = window.setInterval(refresh, 2000);
        return () => window.clearInterval(timer);
    }, [authenticated]);

    return authenticated ? treatment : null;
};
