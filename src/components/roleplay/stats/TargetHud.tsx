import { FC } from 'react';
import lockIcon from '../../../assets/images/roleplay/target-lock.svg';
import { LocalizeText } from '../../../api/utils/LocalizeText';
import { useTargetStats } from '../../../hooks/roleplay/useTargetStats';
import { HudPortrait, HudStat } from './StatsHud';
import './StatsHud.scss';
import './TargetHud.scss';

const label = (key: string, fallback: string) =>
{
    const value = LocalizeText(key);
    return value && value !== key ? value : fallback;
};

export const TargetHud: FC = () =>
{
    const { target, stats, clearTarget, locked, toggleLock, unavailable } = useTargetStats();
    if(!target) return null;

    return (
        <section className="rp-stats-hud rp-target-hud" aria-label={label('roleplay.target.title', 'Target')}>
            <div className="rp-stats-hud__main">
                <HudPortrait figure={target.figure} gender={target.sex} size={34} />
                <div className="rp-stats-hud__body">
                    <div className="rp-stats-hud__identity">
                        <span className="rp-target-hud__label">{label('roleplay.target.label', 'Target')}</span>
                        <div className="rp-stats-hud__name" title={target.name}>{target.name}</div>
                        <button type="button" className="rp-target-hud__lock" aria-label={locked ? 'Unlock target' : 'Lock target'} aria-pressed={!!locked} title={locked ? 'Unlock target' : 'Keep this target across rooms'} onClick={toggleLock}>
                            <img src={lockIcon} width={16} height={24} alt="" draggable={false} />
                        </button>
                        <button type="button" className="rp-target-hud__clear" aria-label="Clear target" title="Clear target" onClick={clearTarget}>
                            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 3 6 6M9 3 3 9" /></svg>
                        </button>
                    </div>
                    {stats ? (
                        <>
                            <HudStat kind="health" value={stats.health} label={label('roleplay.target.health', 'Target health')} />
                            <HudStat kind="energy" value={stats.energy} label={label('roleplay.target.energy', 'Target energy')} />
                        </>
                    ) : (
                        <p className="rp-target-hud__loading" role="status">{unavailable ? 'Target unavailable in this room' : label('roleplay.target.loading', 'Loading…')}</p>
                    )}
                </div>
            </div>
        </section>
    );
};
