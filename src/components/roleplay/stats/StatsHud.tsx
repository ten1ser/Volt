import { CreateLinkEvent } from '@volt/renderer';
import { FC } from 'react';
import { LocalizeText } from '../../../api/utils/LocalizeText';
import { LayoutAvatarImageView } from '../../../common/layout/LayoutAvatarImageView';
import { useRpStats } from '../../../hooks/roleplay/useRpStats';
import { useRoom } from '../../../hooks/rooms/useRoom';
import { useUserDataSnapshot } from '../../../hooks/session/useSessionSnapshots';
import { ScreenEffectsView } from '../effects/ScreenEffectsView';
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
    const { roomSession } = useRoom();
    const { userName, figure, gender } = useUserDataSnapshot();
    if(!stats) return null;

    return (
        <section className="rp-stats-hud" aria-label={label('roleplay.stats.title', 'Your stats')}>
            <ScreenEffectsView health={stats.health} />
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
        </section>
    );
};
