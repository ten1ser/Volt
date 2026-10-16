import { FC } from 'react';
import { LocalizeText } from '../../../api/utils/LocalizeText';
import { LayoutAvatarImageView } from '../../../common/layout/LayoutAvatarImageView';
import { useRpStats } from '../../../hooks/roleplay/useRpStats';
import { useUserDataSnapshot } from '../../../hooks/session/useSessionSnapshots';
import './StatsHud.scss';

const label = (key: string, fallback: string) =>
{
    const value = LocalizeText(key);
    return value && value !== key ? value : fallback;
};

export const StatsHud: FC = () =>
{
    const stats = useRpStats();
    const { userName, figure, gender } = useUserDataSnapshot();
    if(!stats) return null;

    const healthLabel = label('roleplay.stats.health', 'Health');
    const energyLabel = label('roleplay.stats.energy', 'Energy');

    return (
        <section className="rp-stats-hud" aria-label={label('roleplay.stats.title', 'Your stats')}>
            <div className="rp-stats-hud__name" title={userName}>{userName}</div>
            <div className="rp-stats-hud__body">
                <div className="rp-stats-hud__portrait" aria-hidden="true">
                    <LayoutAvatarImageView figure={figure} gender={gender} direction={2} className="rp-stats-hud__avatar" />
                </div>
                <div className="rp-stats-hud__stats">
                    <div className="rp-stats-hud__stat rp-stats-hud__stat--health">
                        <div className="rp-stats-hud__line"><span>{healthLabel}</span><span>{stats.health} / 100</span></div>
                        <div className="rp-stats-hud__track" role="progressbar" aria-label={healthLabel} aria-valuenow={stats.health} aria-valuemin={0} aria-valuemax={100}>
                            <div className="rp-stats-hud__fill" style={{ width: `${ stats.health }%` }} />
                        </div>
                    </div>
                    <div className="rp-stats-hud__stat rp-stats-hud__stat--energy">
                        <div className="rp-stats-hud__line"><span>{energyLabel}</span><span>{stats.energy} / 100</span></div>
                        <div className="rp-stats-hud__track" role="progressbar" aria-label={energyLabel} aria-valuenow={stats.energy} aria-valuemin={0} aria-valuemax={100}>
                            <div className="rp-stats-hud__fill" style={{ width: `${ stats.energy }%` }} />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
