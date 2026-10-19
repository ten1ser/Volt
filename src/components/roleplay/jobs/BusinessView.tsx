import { AddLinkEventTracker, GroupInformationParser, ILinkEventTracker, RemoveLinkEventTracker } from '@volt/renderer';
import { useEffect, useId, useRef, useState } from 'react';
import { GetGroupMembers, GroupMembershipType, GroupType, TryJoinGroup } from '../../../api';
import { LayoutAvatarImageView, LayoutBadgeImageView, VoltCardView } from '../../../common';
import { useRpBusiness } from '../../../hooks/roleplay/useRpBusiness';
import './BusinessView.scss';

type Tab = 'staff' | 'shift' | 'management';
const clock = (milliseconds: number) =>
{
    const seconds = Math.ceil(milliseconds / 1000);
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};

interface BusinessViewProps {
    groupInformation?: GroupInformationParser;
    onClose?: () => void;
}

export const BusinessView = ({ groupInformation, onClose }: BusinessViewProps = {}) =>
{
    const windowId = useId();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>('staff');
    const [search, setSearch] = useState('');
    const [rankFilter, setRankFilter] = useState(0);
    const [page, setPage] = useState(0);
    const [ranks, setRanks] = useState<Record<number, number>>({});
    const panel = useRef<HTMLDivElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const controlled = !!groupInformation;
    const visible = controlled || open;
    const { snapshot, pending, mutating, error, remainingMs, refresh, act, authenticated } = useRpBusiness(visible, { search, rankFilter, page });
    // The existing Jobs endpoint serves one configured corporation. Never show its staff for another group.
    const data = snapshot && (!controlled || snapshot.groupId === groupInformation.id) ? snapshot : null;
    const unrelated = !!snapshot && controlled && snapshot.groupId !== groupInformation.id;
    const companyName = groupInformation?.title || data?.name || 'Hospital';
    const badge = groupInformation?.badge || data?.badge;
    const close = () => controlled ? onClose?.() : setOpen(false);

    useEffect(() =>
    {
        if(controlled) return;
        const tracker: ILinkEventTracker = { eventUrlPrefix: 'businesses/', linkReceived: url =>
        {
            if(url === 'businesses/hide')
            {
                setOpen(false); return;
            }
            if(url !== 'businesses/toggle' && url !== 'businesses/show') return;
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setRanks({});
            setOpen(previous => url === 'businesses/show' || !previous);
        } };
        AddLinkEventTracker(tracker);
        return () => RemoveLinkEventTracker(tracker);
    }, [controlled]);

    if(!authenticated && open) setOpen(false);
    useEffect(() =>
    {
        if(!visible) return;
        const focus = window.setTimeout(() => panel.current?.querySelector<HTMLButtonElement>('.business-close')?.focus(), 0);
        return () =>
        {
            window.clearTimeout(focus);
            const target = opener.current?.closest('[hidden]') ? document.querySelector<HTMLElement>('[aria-controls="district-friends"]') : opener.current;
            target?.focus();
        };
    }, [visible]);
    if(tab === 'management' && data && !data.canManageMembers && !data.canManageRanks) setTab('staff');

    if(!visible || !authenticated) return null;
    const ownRank = data?.ranks.find(rank => rank.level === data.self.level);
    const management = !!(data?.canManageMembers || data?.canManageRanks);
    const busy = pending || !!error;
    const dutyButton = data?.self.member && <button className="business-primary" disabled={busy} type="button" onClick={() => act(data.self.onDuty ? 2 : 1)}>{data.self.onDuty ? 'End shift' : 'Start shift'}</button>;
    const rows = data?.employees.map(user =>
    {
        const rank = data.ranks.find(item => item.level === user.level);
        return <div role="row" className="business-person" key={user.userId}>
            <div role="cell" className="business-identity"><span className="business-avatar"><LayoutAvatarImageView className="business-avatar-figure" figure={user.figure} gender={user.gender} direction={2} /></span><strong>{user.username}</strong></div>
            <div role="cell" className="business-rank">{tab === 'management' && data.canManageRanks ? <label><span className="business-sr">Rank for {user.username}</span><select disabled={busy} value={ranks[user.userId] ?? user.level} onChange={event => setRanks(previous => ({ ...previous, [user.userId]: Number(event.target.value) }))}>{data.ranks.map(item => <option value={item.level} key={item.level}>{item.name}</option>)}</select></label> : rank?.name}</div>
            <div role="cell" className={`business-duty ${user.onDuty ? 'is-working' : ''}`}><span aria-hidden="true" />{user.onDuty ? 'On duty' : 'Off duty'}</div>
            {tab === 'management' && data.canManageRanks && <div role="cell"><button type="button" disabled={busy || ranks[user.userId] === undefined || ranks[user.userId] === user.level} onClick={() =>
            {
                act(3, user.userId, ranks[user.userId]);
                setRanks({});
            }}>Save</button></div>}
        </div>;
    });
    const staffRanks = data?.ranks.slice().sort((a, b) => b.level - a.level).filter(rank => data.employees.some(user => user.level === rank.level));

    return <VoltCardView theme="district" uniqueKey={controlled ? `district-corporation-${groupInformation.id}` : 'district-business'} className="district-business" isResizable={false} constrainToViewport>
        <div ref={panel} role="dialog" aria-labelledby={`${windowId}-title`} onKeyDown={event =>
        {
            if(event.key === 'Escape' && !event.defaultPrevented)
            {
                event.stopPropagation(); close();
            }
        }}>
            <header className="business-titlebar drag-handler"><span id={`${windowId}-title`}>Business/Corporation</span><button type="button" className="business-close" aria-label="Close Business/Corporation" onClick={close}>×</button></header>
            <div className="business-heading">
                <div className="business-badge" aria-label="Job badge">{badge && <LayoutBadgeImageView badgeCode={badge} isGroup showInfo={false} />}</div>
                <div className="business-heading-copy"><h2>{companyName}</h2><div className="business-summary">{data?.available ? <><span>{data.totalEmployees} employees</span><span>{data.onDutyCount} on duty</span></> : <span>Employee directory</span>}</div></div>
            </div>
            <div className="business-tabs" role="tablist" aria-label="Business sections" onKeyDown={event =>
            {
                if(!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
                const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
                const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                event.preventDefault(); tabs[index]?.click(); tabs[index]?.focus();
            }}>{(['staff', 'shift', ...(management ? ['management'] : [])] as Tab[]).map(id => <button type="button" key={id} id={`${windowId}-tab-${id}`} role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`${windowId}-content`} onClick={() => setTab(id)}>{id === 'staff' ? 'Employees' : id === 'shift' ? 'My shift' : 'Management'}</button>)}</div>
            <section id={`${windowId}-content`} role="tabpanel" aria-labelledby={`${windowId}-tab-${tab}`} className="business-content" aria-busy={pending}>
                {error && <div className="business-feedback" role="alert">{error}<button type="button" disabled={pending} onClick={refresh}>Refresh</button></div>}
                {data?.message && <p className="business-feedback" role="status">{data.message}</p>}
                {!snapshot && !error && <p role="status" className="business-empty">Loading employees…</p>}
                {(unrelated || (data && !data.available)) && <div className="business-empty"><h3>Employee directory unavailable</h3><p>{unrelated ? 'This corporation has no linked job or salary directory yet.' : 'Refresh to check whether the business is available.'}</p><button type="button" disabled={pending} onClick={refresh}>Refresh</button></div>}
                {data?.available && tab === 'shift' && <div className="business-shift">
                    <span className={`business-duty ${data.self.onDuty ? 'is-working' : ''}`}><span aria-hidden="true" />{data.self.onDuty ? 'On duty' : 'Off duty'}</span>
                    <h2>{ownRank?.name || 'Join the hospital team'}</h2>
                    <p>{data.self.member ? `${ownRank?.pay} RP Coins for every full 10 minutes on duty.` : 'Apply to join the hospital team. Accepted employees start as Trainee.'}</p>
                    {data.self.onDuty && <><strong className="business-countdown">{clock(remainingMs)}</strong><p>{remainingMs > 0 ? 'Until your next salary' : 'Confirming the next salary…'}</p><progress aria-label="Salary period progress" max={600000} value={600000 - remainingMs} /></>}
                    <p className="business-muted">Work in the hospital room. Leaving, disconnecting or being knocked out ends your shift and discards unfinished time.</p>
                    {dutyButton || (groupInformation?.membershipType === GroupMembershipType.REQUEST_PENDING ? <p role="status">Application pending</p> : (!controlled || groupInformation.type !== GroupType.PRIVATE) && <button type="button" disabled={busy} onClick={() => TryJoinGroup(data.groupId)}>Apply to {companyName}</button>)}
                </div>}
                {data?.available && tab !== 'shift' && <>
                    {tab === 'management' && <div className="business-management">{data.canManageMembers && <button type="button" onClick={() => GetGroupMembers(data.groupId, 0)}>Manage employees & applications</button>}{data.canManageRanks && <p>Saving a new pay rank ends the employee’s current shift.</p>}</div>}
                    <div className="business-filters"><label><span className="business-sr">Search employees</span><input disabled={mutating} maxLength={32} placeholder="Search employees…" value={search} onChange={event =>
                    {
                        setSearch(event.target.value); setPage(0);
                    }} /></label><label><span className="business-sr">Filter by rank</span><select disabled={mutating} value={rankFilter} onChange={event =>
                    {
                        setRankFilter(Number(event.target.value)); setPage(0);
                    }}><option value={0}>All ranks</option>{data.ranks.map(rank => <option key={rank.level} value={rank.level}>{rank.name}</option>)}</select></label></div>
                    {tab === 'staff' ? <div className="business-rank-list" aria-label="Hospital employees">
                        {staffRanks.map(rank => <section className="business-rank-section" aria-labelledby={`${windowId}-rank-${rank.level}`} key={rank.level}>
                            <header><h3 id={`${windowId}-rank-${rank.level}`}>{rank.name}</h3><span className="business-salary">{rank.pay}c <small>/ 10 min</small></span></header>
                            <ul className="business-staff-grid">{data.employees.filter(user => user.level === rank.level).map(user => <li className="business-staff-card" key={user.userId}>
                                <span className="business-staff-portrait" aria-hidden="true"><LayoutAvatarImageView className="business-avatar-figure" figure={user.figure} gender={user.gender} direction={2} /></span>
                                <div><strong>{user.username}</strong><span className={`business-duty ${user.onDuty ? 'is-working' : ''}`}><span aria-hidden="true" />{user.onDuty ? 'On duty' : 'Off duty'}</span></div>
                            </li>)}</ul>
                        </section>)}
                    </div> : <div role="table" aria-label="Hospital employees" className={`business-table ${data.canManageRanks ? 'has-actions' : ''}`}><div role="row" className="business-columns"><span role="columnheader">Employee</span><span role="columnheader">Rank</span><span role="columnheader">Duty</span>{data.canManageRanks && <span role="columnheader">Action</span>}</div>{rows}</div>}
                    {!data.employees.length && <div className="business-empty"><h3>No matching employees</h3><p>Try another name or choose All ranks.</p></div>}
                    <div className="business-pagination"><span>{data.employees.length} of {data.totalMatches} matching employees</span><button type="button" disabled={busy || page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1}</span><button type="button" disabled={busy || (page + 1) * data.pageSize >= data.totalMatches} onClick={() => setPage(value => value + 1)}>Next</button></div>
                </>}
            </section>
            {data?.available && <footer className="business-footer"><div><strong>{ownRank?.name || 'Not employed'}</strong><span>{ownRank ? `${ownRank.pay}c / 10 min` : 'Apply through My shift'}</span></div><div className="business-next-pay">{data.self.onDuty ? <>Next salary <strong>{clock(remainingMs)}</strong></> : 'Off duty'}</div>{dutyButton}</footer>}
        </div>
    </VoltCardView>;
};
