import { AddLinkEventTracker, CreateLinkEvent, GroupInformationEvent, GroupInformationParser, ILinkEventTracker, RemoveLinkEventTracker } from '@volt/renderer';
import { FC, useEffect, useState } from 'react';
import { useMessageEvent } from '../../../hooks';
import { BusinessView } from '../../roleplay/jobs/BusinessView';

export const GroupInformationStandaloneView: FC = () =>
{
    const [groupInformation, setGroupInformation] = useState<GroupInformationParser>(null);

    useMessageEvent<GroupInformationEvent>(GroupInformationEvent, (event) =>
    {
        const parser = event.getParser();

        if ((groupInformation && groupInformation.id === parser.id) || parser.flag)
        {
            if (parser.flag) CreateLinkEvent('businesses/hide');
            setGroupInformation(parser);
        }
    });

    useEffect(() =>
    {
        const tracker: ILinkEventTracker = { eventUrlPrefix: 'businesses/', linkReceived: url =>
        {
            if (url === 'businesses/show' || url === 'businesses/toggle') setGroupInformation(null);
        } };
        AddLinkEventTracker(tracker);
        return () => RemoveLinkEventTracker(tracker);
    }, []);

    if (!groupInformation) return null;

    return <BusinessView groupInformation={groupInformation} onClose={() => setGroupInformation(null)} />;
};
