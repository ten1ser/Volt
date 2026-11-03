import { useId, useState } from 'react';
import { VoltCardView } from '../../../common';
import { LayoutAvatarImageView } from '../../../common/layout/LayoutAvatarImageView';
import { killDeathRatio, useRpProfile } from '../../../hooks/roleplay/useRpProfile';
import './RpProfileView.scss';

const stat = (label: string, value: string | number, accent = false, title?: string) => (
    <div className="rp-profile__stat" key={label} title={title}>
        <strong className={accent ? 'is-accent' : undefined}>{value}</strong>
        <span>{label}</span>
    </div>
);

const TABS = [{ id: 'fights', label: 'Combat' }, { id: 'punches', label: 'Punches' }] as const;

/** DistrictRP user profile: avatar, name, gang, job and rank, and lifetime fight counters. */
export const RpProfileView = () =>
{
    const windowId = useId();
    const { identity, card, close } = useRpProfile();
    // Combat counters lead; the punch counters sit on their own tab.
    const [tab, setTab] = useState<'fights' | 'punches'>('fights');

    if(!identity) return null;

    const loading = !card;
    const value = (count: number | undefined) => (loading || !card.available ? '–' : count);
    const role = card?.job ? (card.rank ? `${card.job}, ${card.rank}` : card.job) : card ? 'Unemployed' : '';

    return <VoltCardView theme="district" uniqueKey="district-profile" className="rp-profile district-rp-window" isResizable={false} constrainToViewport cascade>
        <div role="dialog" aria-labelledby={`${windowId}-title`} onKeyDown={event =>
        {
            if(event.key === 'Escape' && !event.defaultPrevented)
            {
                event.stopPropagation(); close();
            }
        }}>
            <header className="rp-profile__titlebar district-rp-titlebar drag-handler">
                <span>Profile</span>
                <button type="button" className="rp-profile__close district-rp-close" aria-label="Close profile" onClick={close}>×</button>
            </header>
            <div className={`rp-profile__banner ${card?.gang ? 'has-gang' : ''}`}>
                <div className="rp-profile__portrait" aria-hidden="true">
                    <LayoutAvatarImageView figure={identity.figure} direction={2} className="rp-profile__avatar" />
                </div>
                <div className="rp-profile__identity">
                    <h2 id={`${windowId}-title`} className="rp-profile__name">{identity.username}</h2>
                    <p className="rp-profile__role">
                        {card?.gang && <span className="rp-profile__gang">{card.gang}</span>}
                        {card?.gang && role && <span aria-hidden="true"> · </span>}
                        {role && <span className="rp-profile__job">{role}</span>}
                    </p>
                </div>
            </div>
            <div className="rp-profile__body" aria-busy={loading}>
                {card && !card.available
                    ? <p className="rp-profile__notice" role="status">This profile is not available.</p>
                    : <>
                        <div className="rp-profile__tabs" role="tablist" aria-label="Stats">
                            {TABS.map(entry => (
                                <button key={entry.id} type="button" role="tab" id={`${windowId}-tab-${entry.id}`} aria-selected={tab === entry.id}
                                    aria-controls={`${windowId}-panel`} onClick={() => setTab(entry.id)}>{entry.label}</button>
                            ))}
                        </div>
                        <div id={`${windowId}-panel`} role="tabpanel" aria-labelledby={`${windowId}-tab-${tab}`}>
                            {tab === 'fights'
                                ? <div className="rp-profile__row rp-profile__row--fights">
                                    {stat('K/D', loading ? '–' : killDeathRatio(card.kills, card.deaths), true, !loading && card.deaths === 0 ? 'No deaths yet: K/D is the kill count' : undefined)}
                                    {stat('Kills', value(card?.kills))}
                                    {stat('Deaths', value(card?.deaths))}
                                    {stat('Jailed', value(card?.timesJailed))}
                                </div>
                                : <div className="rp-profile__row rp-profile__row--punches">
                                    {stat('Thrown', value(card?.punchesThrown))}
                                    {stat('Missed', value(card?.punchesMissed))}
                                    {stat('Received', value(card?.punchesReceived))}
                                </div>}
                        </div>
                    </>}
            </div>
        </div>
    </VoltCardView>;
};
