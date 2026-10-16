import { CreateLinkEvent } from '@volt/renderer';
import { FC } from 'react';
import { GetConfigurationValue, localizeWithFallback } from '../../../api';
import { usePurse } from '../../../hooks';
import { StatsHud } from '../stats/StatsHud';
import './DistrictHud.scss';

export const DistrictHud: FC = () =>
{
    const { purse } = usePurse();
    const currencies = GetConfigurationValue<number[]>('system.currency.types', []);

    return (
        <header className="district-hud-top" aria-label="DistrictRP player dashboard">
            <StatsHud />
            <div className="district-hud-brand" aria-label="DistrictRP">
                <span>DISTRICT<span>RP</span></span>
                <small>YOUR CITY. YOUR STORY.</small>
            </div>
            <section className="district-wallet district-panel" aria-label="Your balances">
                <div className="district-wallet__heading">
                    <span>DISTRICTRP</span>
                    <button type="button" aria-label="Settings" title="Settings" onClick={() => CreateLinkEvent('user-settings/show/other')}>
                        <span className="volt-icon icon-me-settings" aria-hidden="true" />
                    </button>
                </div>
                <dl className="district-wallet__balances">
                    <div className="district-wallet__credits">
                        <dt>{localizeWithFallback('roleplay.currency.coins', 'RP Coins')}</dt>
                        <dd>{(purse?.credits ?? 0).toLocaleString()}</dd>
                    </div>
                    {currencies.includes(5) && <div><dt>{localizeWithFallback('purse.diamonds', 'Diamonds')}</dt><dd>{(purse?.activityPoints.get(5) ?? 0).toLocaleString()}</dd></div>}
                    {currencies.includes(0) && <div><dt>{localizeWithFallback('purse.duckets', 'Duckets')}</dt><dd>{(purse?.activityPoints.get(0) ?? 0).toLocaleString()}</dd></div>}
                </dl>
            </section>
        </header>
    );
};
