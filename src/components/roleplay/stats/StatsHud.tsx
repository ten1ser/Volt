import { CreateLinkEvent } from '@volt/renderer';
import { FC } from 'react';
import { LocalizeText } from '../../../api/utils/LocalizeText';
import { LayoutAvatarImageView } from '../../../common/layout/LayoutAvatarImageView';
import { useRpStats } from '../../../hooks/roleplay/useRpStats';
import { useRpHospitalTreatment } from '../../../hooks/roleplay/useRpHospitalTreatment';
import { useRoom } from '../../../hooks/rooms/useRoom';
import { useUserDataSnapshot } from '../../../hooks/session/useSessionSnapshots';
import './StatsHud.scss';

const label = (key: string, fallback: string) =>
{
    const value = LocalizeText(key);
    return value && value !== key ? value : fallback;
};

/** Native full-body bitmap trimmed to its pixels, top-aligned so the 56px frame crops it at the waist. */
export const HudPortrait: FC<{ figure: string; gender?: string; direction?: number }> = ({ figure, gender, direction = 2 }) => (
    <div className="rp-stats-hud__portrait" aria-hidden="true">
        <LayoutAvatarImageView classNames={['rp-stats-hud__avatar']} direction={direction} figure={figure} gender={gender} nativeCroppedHead trimmed />
    </div>
);

/** One labelled bar with its value, shared by the own and target cards. */
export const HudStat: FC<{ kind: 'health' | 'energy'; value: number; label: string }> = ({ kind, value, label }) => (
    <div className={`rp-stats-hud__stat rp-stats-hud__stat--${kind}`}>
        {kind === 'health'
            ? <svg className="rp-stats-hud__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14 1 7V3h2V1h4v2h2V1h4v2h2v4Z" /></svg>
            : <svg className="rp-stats-hud__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 1 2 9h5l-1 6 8-9H9Z" /></svg>}
        <div className="rp-stats-hud__track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} title={`${ value } / 100`}>
            <div className="rp-stats-hud__fill" style={{ width: `${ value }%` }} />
            <span className="rp-stats-hud__value" aria-hidden="true">{ value } / 100</span>
        </div>
    </div>
);

export const StatsHud: FC = () =>
{
    const stats = useRpStats();
    const treatment = useRpHospitalTreatment();
    const { roomSession } = useRoom();
    const { userName, figure, gender } = useUserDataSnapshot();
    if(!stats) return null;

    const treatmentLabel = label('roleplay.hospital.treatment', 'Hospital treatment');
    const progress = treatment && Number.isFinite(treatment.progress) ? Math.min(100, Math.max(0, Math.round(treatment.progress))) : 0;
    const remainingSeconds = treatment && Number.isFinite(treatment.remainingMs) && treatment.remainingMs > 0
        ? Math.ceil(treatment.remainingMs / 1000) : 0;

    return (
        <section className="rp-stats-hud" aria-label={label('roleplay.stats.title', 'Your stats')}>
            <div className="rp-stats-hud__main">
                <button
                    type="button"
                    className="rp-stats-hud__portrait-toggle"
                    aria-label="Toggle your player card"
                    aria-controls="district-player-card"
                    title="Toggle your player card"
                    disabled={!roomSession}
                    onClick={() => CreateLinkEvent('avatar-info/toggle-own')}
                >
                    <HudPortrait figure={figure} gender={gender} />
                </button>
                <div className="rp-stats-hud__body">
                    <div className="rp-stats-hud__identity">
                        <div className="rp-stats-hud__name" title={userName}>{userName}</div>
                    </div>
                    <HudStat kind="health" value={stats.health} label={label('roleplay.stats.health', 'Health')} />
                    <HudStat kind="energy" value={stats.energy} label={label('roleplay.stats.energy', 'Energy')} />
                </div>
            </div>
            { treatment && treatment.phase !== 0 && (
                <div className={ `rp-stats-hud__treatment rp-stats-hud__treatment--${ treatment.phase === 1 ? 'transfer' : 'healing' }` }>
                    <div className="rp-stats-hud__treatment-row">
                        <span className="rp-stats-hud__treatment-title">
                            { treatment.phase === 1 ? label('roleplay.hospital.transfer', 'Hospital transfer') : treatmentLabel }
                        </span>
                        <span className="rp-stats-hud__treatment-meta" aria-hidden="true">
                            { treatment.phase === 1 ? `${ remainingSeconds }s` : `${ progress }%` }
                        </span>
                    </div>
                    { treatment.phase === 2 && (
                        <>
                            <div className="rp-stats-hud__treatment-track" role="progressbar" aria-label={ treatmentLabel } aria-valuenow={ progress } aria-valuemin={ 0 } aria-valuemax={ 100 }>
                                <div className="rp-stats-hud__treatment-fill" style={ { width: `${ progress }%` } } />
                            </div>
                            <div className="rp-stats-hud__treatment-note">{ label('roleplay.hospital.locked', 'Movement and chat locked') }</div>
                        </>
                    ) }
                </div>
            ) }
        </section>
    );
};
