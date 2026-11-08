import { CSSProperties, FC, ReactNode } from 'react';
import { LocalizeText } from '../../../api/utils/LocalizeText';
import { FEED_LINE_MS, RpFeedLine, useRpFeed } from '../../../hooks/roleplay/useRpFeed';
import { useRpHospitalTreatment } from '../../../hooks/roleplay/useRpHospitalTreatment';
import './RoleplayFeedView.scss';

const KIND_CLASS = ['is-kill', 'is-kill', 'is-wanted', 'is-bounty', 'is-arrest'];
const PROGRESS_LABEL = ['Reloading pistol', 'Pickpocketing'];

const name = (value: string) => <b>{value}</b>;

const label = (key: string, fallback: string) =>
{
    const value = LocalizeText(key);
    return value && value !== key ? value : fallback;
};

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

/** Roleplay log at the bottom left, the own action progress bar above the chat bar and the hospital transfer/treatment bar in its place. Neither catches clicks. */
export const RoleplayFeedView: FC = () =>
{
    const { lines, progress } = useRpFeed();
    const treatment = useRpHospitalTreatment();
    const pct = treatment && Number.isFinite(treatment.progress) ? Math.min(100, Math.max(0, Math.round(treatment.progress))) : 0;
    const remainingSeconds = treatment && Number.isFinite(treatment.remainingMs) && treatment.remainingMs > 0
        ? Math.ceil(treatment.remainingMs / 1000) : 0;
    const title = treatment && treatment.phase === 1
        ? label('roleplay.hospital.transfer', 'Hospital transfer')
        : label('roleplay.hospital.treatment', 'Hospital treatment');

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
            {!progress && treatment && treatment.phase !== 0 && (
                <div className={`district-action-progress district-action-progress--treatment ${treatment.phase === 1 ? 'is-transfer' : 'is-healing'}`} role="status">
                    <span>{title}</span>
                    {treatment.phase === 2 && (
                        <i role="progressbar" aria-label={title} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></i>
                    )}
                    <b className="district-action-progress__meta" aria-hidden="true">{treatment.phase === 1 ? `${remainingSeconds}s` : `${pct}%`}</b>
                </div>
            )}
        </>
    );
};
