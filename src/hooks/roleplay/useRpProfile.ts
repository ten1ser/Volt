import { RoomEngineObjectEvent, RoomObjectCategory, RoomObjectType, RpProfileEvent, RpProfileRequestComposer, UserProfileEvent } from '@volt/renderer';
import { useCallback, useRef, useState } from 'react';
import { GetRoomSession } from '../../api/volt/session/GetRoomSession';
import { GetUserProfile } from '../../api/user/GetUserProfile';
import { SendMessageComposer } from '../../api/volt/SendMessageComposer';
import { useConnectionState } from '../events/useConnectionState';
import { useMessageEvent } from '../events/useMessageEvent';
import { useVoltEvent } from '../events/useVoltEvent';

export interface RpProfileIdentity
{
    userId: number;
    username: string;
    figure: string;
}

export interface RpProfileCard
{
    available: boolean;
    gang: string;
    job: string;
    rank: string;
    kills: number;
    deaths: number;
    punchesThrown: number;
    punchesMissed: number;
    punchesReceived: number;
    timesJailed: number;
}

let nextRequestId = 0;
const allocateRequestId = () =>
{
    nextRequestId = nextRequestId % 2147483647 + 1;
    return nextRequestId;
};

/** Kills per death; with no deaths the ratio is the kill count. */
export const killDeathRatio = (kills: number, deaths: number): string => (deaths > 0 ? kills / deaths : kills).toFixed(2);

/**
 * The DistrictRP profile window. Every existing "open profile" path still sends the native profile request; its reply gives
 * the name and look and opens the window, then packet 6090 fills in the gang, job and fight counters for that user.
 */
export const useRpProfile = () =>
{
    const { authenticated } = useConnectionState();
    const [identity, setIdentity] = useState<RpProfileIdentity | null>(null);
    const [card, setCard] = useState<RpProfileCard | null>(null);
    const pending = useRef({ requestId: 0, userId: 0 });

    useMessageEvent<UserProfileEvent>(UserProfileEvent, useCallback(event =>
    {
        const parser = event.getParser();
        if(!parser || parser.id <= 0) return;

        setIdentity({ userId: parser.id, username: parser.username, figure: parser.figure });
        if(pending.current.userId !== parser.id) setCard(null);

        const requestId = allocateRequestId();
        pending.current = { requestId, userId: parser.id };
        try
        {
            SendMessageComposer(new RpProfileRequestComposer(requestId, parser.id));
        }
        catch
        {
            setCard(null);
        }
    }, []));

    useMessageEvent<RpProfileEvent>(RpProfileEvent, useCallback(event =>
    {
        const parser = event.getParser();
        // Only the newest request may fill the window, so a slow reply for a previous profile never shows under another name.
        if(parser.requestId !== pending.current.requestId || parser.userId !== pending.current.userId) return;

        setCard({
            available: parser.available,
            gang: parser.gang,
            job: parser.job,
            rank: parser.rank,
            kills: parser.kills,
            deaths: parser.deaths,
            punchesThrown: parser.punchesThrown,
            punchesMissed: parser.punchesMissed,
            punchesReceived: parser.punchesReceived,
            timesJailed: parser.timesJailed
        });
    }, []));

    // As in the native profile, clicking another player while the window is open switches to their profile.
    useVoltEvent<RoomEngineObjectEvent>(RoomEngineObjectEvent.SELECTED, event =>
    {
        if(!identity || event.category !== RoomObjectCategory.UNIT) return;

        const userData = GetRoomSession()?.userDataManager.getUserDataByIndex(event.objectId);
        if(!userData || userData.type !== RoomObjectType.USER || userData.webID === identity.userId) return;

        GetUserProfile(userData.webID);
    });

    const close = useCallback(() =>
    {
        pending.current = { requestId: 0, userId: 0 };
        setIdentity(null);
        setCard(null);
    }, []);

    return { identity: authenticated ? identity : null, card: authenticated ? card : null, close };
};
