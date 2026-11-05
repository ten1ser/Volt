import { CSSProperties, FC, ReactNode } from 'react';
import { FEED_LINE_MS, RpFeedLine, useRpFeed } from '../../../hooks/roleplay/useRpFeed';
import './RoleplayFeedView.scss';

const KIND_CLASS = ['is-kill', 'is-kill', 'is-wanted', 'is-bounty', 'is-arrest'];
const PROGRESS_LABEL = ['Reloading pistol', 'Pickpocketing'];

const name = (value: string) => <b>{value}</b>;

/** Words one log line; the server only sends the kind, the two names and the detail. */
export const describeFeedLine = (line: RpFeedLine): ReactNode =>
{
    switch(line.kind)
    {
        case 0: return <>{name(line.actorName)} just shot and killed {name(line.targetName)}.</>;
        case 1: return <>{name(line.actorName)} {line.detail === 'knife' ? 'stabbed' : 'smashed'} and killed {name(line.targetName)}.</>;
        case 2: return <>{name(line.actorName)} is now wanted for {line.detail}.</>;
        case 3: return <>{name(line.actorName)} listed a bounty on {name(line.targetName)} for ${Number(line.detail).toLocaleString()}.</>;
        default: return <>{name(line.actorName)} just got arrested.</>;
    }
};

/** Roleplay log at the bottom left and the own action progress bar above the chat bar. Neither catches clicks. */
export const RoleplayFeedView: FC = () =>
{
    const { lines, progress } = useRpFeed();

    return (
        <>
            <ol className="district-feed" role="log" aria-live="polite" aria-label="Roleplay log" style={{ '--district-feed-life': `${FEED_LINE_MS}ms` } as CSSProperties}>
                {lines.map(line => <li key={line.id} className={KIND_CLASS[line.kind] ?? ''}>{describeFeedLine(line)}</li>)}
            </ol>
            {progress && (
                <div key={progress.id} className="district-action-progress" role="status" style={{ '--district-progress-ms': `${progress.durationMs}ms` } as CSSProperties}>
                    <span>{PROGRESS_LABEL[progress.kind] ?? 'Working'}</span>
                    <i aria-hidden="true"><i /></i>
                </div>
            )}
        </>
    );
};
