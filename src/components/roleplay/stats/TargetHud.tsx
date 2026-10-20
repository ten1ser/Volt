import { FC } from 'react';
import { LocalizeText } from '../../../api/utils/LocalizeText';
import { LayoutAvatarImageView } from '../../../common/layout/LayoutAvatarImageView';
import { useTargetStats } from '../../../hooks/roleplay/useTargetStats';
import './StatsHud.scss';
import './TargetHud.scss';

const label = (key: string, fallback: string) =>
{
    const value = LocalizeText(key);
    return value && value !== key ? value : fallback;
};

export const TargetHud: FC = () =>
{
    const { target, stats, clearTarget } = useTargetStats();
    if(!target) return null;

    const healthLabel = label('roleplay.target.health', 'Target health');
    const energyLabel = label('roleplay.target.energy', 'Target energy');

    return (
        <section className="rp-stats-hud rp-target-hud" aria-label={label('roleplay.target.title', 'Target')}>
            <div className="rp-stats-hud__portrait" aria-hidden="true">
                <LayoutAvatarImageView figure={target.figure} gender={target.sex} direction={2} className="rp-stats-hud__avatar" />
            </div>
            <div className="rp-stats-hud__body">
                <div className="rp-stats-hud__stats">
                    <div className="rp-stats-hud__identity">
                        <span className="rp-target-hud__label">{label('roleplay.target.label', 'Target')}</span>
                        <div className="rp-stats-hud__name" title={target.name}>{target.name}</div>
                        <button type="button" className="rp-target-hud__clear" aria-label="Clear target" title="Clear target" onClick={clearTarget}>×</button>
                    </div>
                    {stats ? (
                        <>
                            <div className="rp-stats-hud__stat rp-stats-hud__stat--health">
                                <svg className="rp-stats-hud__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14 1 7V3h2V1h4v2h2V1h4v2h2v4Z" /></svg>
                                <div className="rp-stats-hud__track" role="progressbar" aria-label={healthLabel} aria-valuenow={stats.health} aria-valuemin={0} aria-valuemax={100}>
                                    <div className="rp-stats-hud__fill" style={{ width: `${ stats.health }%` }} />
                                    <span className="rp-stats-hud__value" aria-hidden="true">{stats.health} / 100</span>
                                </div>
                            </div>
                            <div className="rp-stats-hud__stat rp-stats-hud__stat--energy">
                                <svg className="rp-stats-hud__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 1 2 9h5l-1 6 8-9H9Z" /></svg>
                                <div className="rp-stats-hud__track" role="progressbar" aria-label={energyLabel} aria-valuenow={stats.energy} aria-valuemin={0} aria-valuemax={100}>
                                    <div className="rp-stats-hud__fill" style={{ width: `${ stats.energy }%` }} />
                                    <span className="rp-stats-hud__value" aria-hidden="true">{stats.energy} / 100</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="rp-target-hud__loading" role="status">{label('roleplay.target.loading', 'Loading…')}</p>
                    )}
                </div>
            </div>
        </section>
    );
};
