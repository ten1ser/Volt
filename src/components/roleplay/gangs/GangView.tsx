import { AddLinkEventTracker, ILinkEventTracker, RemoveLinkEventTracker, RpGang, RpGangRank } from '@volt/renderer';
import { useEffect, useId, useRef, useState } from 'react';
import { LayoutAvatarImageView, LayoutBadgeImageView, VoltCardView } from '../../../common';
import { useGroup } from '../../../hooks/groups/useGroup';
import { GangAction, useRpGang } from '../../../hooks/roleplay/useRpGang';
import './GangView.scss';

type Tab = 'members' | 'ranks' | 'requests' | 'settings';
type Badge = { base: number; baseColor: number; symbol: number; symbolColor: number; position: number };

const pad = (value: number) => (value < 10 ? '0' : '') + value;
export const badgeCode = (badge: Badge) => `b${pad(badge.base)}${pad(badge.baseColor)}4` + (badge.symbol ? `s${pad(badge.symbol)}${pad(badge.symbolColor)}${badge.position}` : '');
export const badgeParts = (badge: Badge) => [[badge.base, badge.baseColor, 4], ...(badge.symbol ? [[badge.symbol, badge.symbolColor, badge.position]] : [])];
export const killDeath = (kills: number, deaths: number) => (deaths === 0 ? kills : kills / deaths).toFixed(2);
// The Leader acts on every other rank; a rank with Manage gang only on ranks below it.
export const outranks = (me: RpGangRank | undefined, rank: RpGangRank) => !!me && !rank.isLeader && (me.isLeader || (me.canManage && rank.position > me.position));

const DEFAULT_BADGE: Badge = { base: 1, baseColor: 1, symbol: 0, symbolColor: 1, position: 4 };

const BadgePicker = ({ value, onChange }: { value: Badge; onChange: (badge: Badge) => void }) =>
{
    const { groupCustomize } = useGroup();
    if(!groupCustomize) return <p className="gang-muted">Loading badge parts…</p>;
    const colors = groupCustomize.badgePartColors;
    const swatches = (selected: number, pick: (id: number) => void, label: string) => <div className="gang-swatches" role="radiogroup" aria-label={label}>
        {colors.map(color => <button type="button" role="radio" aria-checked={selected === color.id} aria-label={`${label} ${color.id}`} key={color.id} style={{ background: '#' + color.color }} onClick={() => pick(color.id)} />)}
    </div>;
    return <div className="gang-badge-picker">
        <div className="gang-badge-preview"><LayoutBadgeImageView badgeCode={badgeCode(value)} isGroup showInfo={false} /></div>
        <div className="gang-badge-controls">
            <span className="gang-label">Shape</span>
            <div className="gang-parts">{groupCustomize.badgeBases.map(base => <button type="button" aria-pressed={value.base === base.id} aria-label={`Shape ${base.id}`} key={base.id} onClick={() => onChange({ ...value, base: base.id })}>
                <LayoutBadgeImageView badgeCode={`b${pad(base.id)}${pad(value.baseColor)}4`} isGroup showInfo={false} /></button>)}</div>
            {swatches(value.baseColor, id => onChange({ ...value, baseColor: id }), 'Shape colour')}
            <span className="gang-label">Symbol</span>
            <div className="gang-parts"><button type="button" aria-pressed={value.symbol === 0} onClick={() => onChange({ ...value, symbol: 0 })}>None</button>
                {groupCustomize.badgeSymbols.map(symbol => <button type="button" aria-pressed={value.symbol === symbol.id} aria-label={`Symbol ${symbol.id}`} key={symbol.id} onClick={() => onChange({ ...value, symbol: symbol.id })}>
                    <LayoutBadgeImageView badgeCode={`s${pad(symbol.id)}${pad(value.symbolColor)}4`} isGroup showInfo={false} /></button>)}</div>
            {!!value.symbol && <>{swatches(value.symbolColor, id => onChange({ ...value, symbolColor: id }), 'Symbol colour')}
                <div className="gang-positions" role="radiogroup" aria-label="Symbol position">{Array.from({ length: 9 }, (_, index) => <button type="button" role="radio" aria-checked={value.position === index} aria-label={`Position ${index + 1}`} key={index} onClick={() => onChange({ ...value, position: index })} />)}</div></>}
        </div>
    </div>;
};

const GangForm = ({ submitLabel, busy, initial, onSubmit }: { submitLabel: string; busy: boolean; initial?: { name: string; description: string }; onSubmit: (json: string) => void }) =>
{
    const [name, setName] = useState(initial?.name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [badge, setBadge] = useState<Badge>(DEFAULT_BADGE);
    const valid = name.trim().length >= 3;
    return <form className="gang-form" onSubmit={event =>
    {
        event.preventDefault();
        if(valid) onSubmit(JSON.stringify({ name: name.trim(), description: description.trim(), badge: badgeParts(badge) }));
    }}>
        <label><span className="gang-label">Name</span><input maxLength={24} value={name} placeholder="3–24 letters or numbers" onChange={event => setName(event.target.value)} /></label>
        <label><span className="gang-label">Description</span><input maxLength={120} value={description} placeholder="Optional" onChange={event => setDescription(event.target.value)} /></label>
        <span className="gang-label">Badge</span>
        <BadgePicker value={badge} onChange={setBadge} />
        <button className="gang-primary" type="submit" disabled={busy || !valid}>{submitLabel}</button>
    </form>;
};

export const GangView = () =>
{
    const windowId = useId();
    const [open, setOpen] = useState(false);
    const [viewId, setViewId] = useState(0);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<Tab>('members');
    const [selected, setSelected] = useState(0);
    const [newRank, setNewRank] = useState('');
    const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
    const [confirm, setConfirm] = useState<'leave' | 'disband' | number | null>(null);
    const [disbandName, setDisbandName] = useState('');
    const [creating, setCreating] = useState(false);
    const panel = useRef<HTMLDivElement>(null);
    const { snapshot, pending, error, authenticated, refresh, act } = useRpGang(open, { viewId, search });

    useEffect(() =>
    {
        const tracker: ILinkEventTracker = { eventUrlPrefix: 'gangs/', linkReceived: url =>
        {
            if(url === 'gangs/hide')
            {
                setOpen(false); return;
            }
            const view = /^gangs\/view\/(\d{1,10})$/.exec(url);
            if(view)
            {
                setViewId(Number(view[1])); setTab('members'); setOpen(true); return;
            }
            if(url !== 'gangs/toggle' && url !== 'gangs/show') return;
            setViewId(0);
            setTab('members');
            setOpen(previous => url === 'gangs/show' || !previous);
        } };
        AddLinkEventTracker(tracker);
        return () => RemoveLinkEventTracker(tracker);
    }, []);

    if(!authenticated && open) setOpen(false);
    if(!open || !authenticated) return null;

    const gang: RpGang | null = snapshot?.gang ?? null;
    const own = !!gang && gang.id === snapshot?.myGangId;
    const me = own ? gang.ranks.find(rank => rank.id === gang.myRankId) : undefined;
    const busy = pending || !!error;
    const close = () => setOpen(false);
    const run = (action: number, options: Parameters<typeof act>[1] = {}) =>
    {
        setConfirm(null); setSelected(0); setRenaming(null);
        act(action, options);
    };
    const tabs: Tab[] = own ? ['members', 'ranks', ...(gang.canManage ? ['requests' as Tab] : []), 'settings'] : ['members'];
    const current = tabs.includes(tab) ? tab : 'members';
    const ranks = gang ? gang.ranks.slice().sort((a, b) => a.position - b.position || a.id - b.id) : [];
    const outsideRanks = ranks.filter(rank => !rank.isLeader);

    const landing = snapshot && !gang && <div className="gang-landing">
        <section className="gang-panel">
            <h3>Found a gang</h3>
            <p className="gang-muted">Costs {snapshot.cost} RP Coins. You become its Leader; up to {snapshot.maxMembers} members join by request.</p>
            {creating ? <GangForm submitLabel={`Found gang for ${snapshot.cost}c`} busy={busy} onSubmit={json => act(GangAction.Create, { value: json })} />
                : <button type="button" className="gang-primary" onClick={() => setCreating(true)}>Found a gang</button>}
        </section>
        <section className="gang-panel">
            <h3>Find a gang</h3>
            <form className="gang-search" onSubmit={event =>
            {
                event.preventDefault(); act(GangAction.Search, { value: search.trim() });
            }}><label><span className="gang-sr">Search gangs</span><input maxLength={24} placeholder="Gang name…" value={search} onChange={event => setSearch(event.target.value)} /></label><button type="submit" disabled={busy}>Search</button></form>
            {!snapshot.search.length && <p className="gang-muted">No gangs found.</p>}
            <ul className="gang-list">{snapshot.search.map(item => <li key={item.id}>
                <span className="gang-list-badge"><LayoutBadgeImageView badgeCode={item.badge} isGroup showInfo={false} /></span>
                <div><strong>{item.name}</strong><span className="gang-muted">{item.memberCount} / {snapshot.maxMembers} · Leader {item.leaderName}</span></div>
                <button type="button" onClick={() => setViewId(item.id)}>View</button>
                {item.requested ? <button type="button" disabled={busy} onClick={() => run(GangAction.CancelRequest, { gangId: item.id })}>Cancel request</button>
                    : <button type="button" className="gang-primary" disabled={busy || item.memberCount >= snapshot.maxMembers} onClick={() => run(GangAction.RequestJoin, { gangId: item.id })}>Ask to join</button>}
            </li>)}</ul>
        </section>
    </div>;

    const members = gang && <div className="gang-rank-list">{ranks.filter(rank => gang.members.some(member => member.rankId === rank.id)).map(rank => <section className="gang-rank-section" key={rank.id} aria-labelledby={`${windowId}-rank-${rank.id}`}>
        <header><h3 id={`${windowId}-rank-${rank.id}`}>{rank.name}</h3>{rank.canManage && <span className="gang-tag">{rank.isLeader ? 'Leader' : 'Manager'}</span>}</header>
        <ul className="gang-member-grid">{gang.members.filter(member => member.rankId === rank.id).map(member =>
        {
            const actionable = own && outranks(me, rank);
            const handOver = own && gang.isLeader && !rank.isLeader;
            return <li className="gang-member" key={member.userId}>
                <span className="gang-portrait" aria-hidden="true"><LayoutAvatarImageView className="gang-portrait-figure" figure={member.figure} gender={member.gender} direction={2} /></span>
                <div className="gang-member-copy"><strong>{member.username}</strong><span className={`gang-online ${member.online ? 'is-online' : ''}`}><span aria-hidden="true" />{member.online ? 'Online' : 'Offline'}</span></div>
                {(actionable || handOver) && <button type="button" className="gang-more" aria-expanded={selected === member.userId} aria-label={`Manage ${member.username}`} onClick={() => setSelected(value => value === member.userId ? 0 : member.userId)}>⋯</button>}
                {selected === member.userId && <div className="gang-member-actions">
                    {actionable && <label><span className="gang-sr">Rank for {member.username}</span><select disabled={busy} value={rank.id} onChange={event => run(GangAction.SetRank, { target: member.userId, rank: Number(event.target.value) })}>
                        {outsideRanks.filter(item => outranks(me, item)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
                    {actionable && <button type="button" disabled={busy} onClick={() => run(GangAction.Kick, { target: member.userId })}>Kick</button>}
                    {handOver && (confirm === member.userId
                        ? <button type="button" className="gang-danger" disabled={busy} onClick={() => run(GangAction.TransferLeadership, { target: member.userId })}>Confirm: make Leader</button>
                        : <button type="button" disabled={busy} onClick={() => setConfirm(member.userId)}>Make Leader</button>)}
                </div>}
            </li>;
        })}</ul>
    </section>)}</div>;

    const rankEditor = gang && own && <div className="gang-ranks">
        <ul>{ranks.map((rank, index) =>
        {
            const editable = rank.isLeader ? gang.isLeader : outranks(me, rank);
            const below = outsideRanks.indexOf(rank);
            return <li key={rank.id} className="gang-rank-row">
                {renaming?.id === rank.id ? <form onSubmit={event =>
                {
                    event.preventDefault(); run(GangAction.RenameRank, { rank: rank.id, value: renaming.name.trim() });
                }}><input autoFocus maxLength={24} value={renaming.name} aria-label={`New name for ${rank.name}`} onChange={event => setRenaming({ id: rank.id, name: event.target.value })} /><button type="submit" disabled={busy || !renaming.name.trim()}>Save</button><button type="button" onClick={() => setRenaming(null)}>Cancel</button></form>
                    : <><span className="gang-rank-index">{index + 1}</span><strong>{rank.name}</strong><span className="gang-muted">{rank.members} {rank.members === 1 ? 'member' : 'members'}</span></>}
                {rank.isLeader ? <span className="gang-tag">Every permission</span> : <label className="gang-toggle"><input type="checkbox" disabled={busy || !editable} checked={rank.canManage} onChange={event => run(GangAction.SetRankManage, { rank: rank.id, value: event.target.checked ? '1' : '0' })} />Manage gang</label>}
                {editable && renaming?.id !== rank.id && <div className="gang-rank-buttons">
                    <button type="button" disabled={busy} onClick={() => setRenaming({ id: rank.id, name: rank.name })}>Rename</button>
                    {!rank.isLeader && <><button type="button" aria-label={`Move ${rank.name} up`} disabled={busy || below <= 0 || !outranks(me, outsideRanks[below - 1])} onClick={() => run(GangAction.MoveRank, { rank: rank.id, value: 'up' })}>▲</button>
                        <button type="button" aria-label={`Move ${rank.name} down`} disabled={busy || below >= outsideRanks.length - 1} onClick={() => run(GangAction.MoveRank, { rank: rank.id, value: 'down' })}>▼</button>
                        <button type="button" disabled={busy || rank.members > 0 || outsideRanks.length <= 1} title={rank.members > 0 ? 'Move its members first' : undefined} onClick={() => run(GangAction.DeleteRank, { rank: rank.id })}>Delete</button></>}
                </div>}
            </li>;
        })}</ul>
        {gang.canManage && <form className="gang-search" onSubmit={event =>
        {
            event.preventDefault(); run(GangAction.CreateRank, { value: newRank.trim() }); setNewRank('');
        }}><label><span className="gang-sr">New rank name</span><input maxLength={24} placeholder="New rank name…" value={newRank} onChange={event => setNewRank(event.target.value)} /></label><button type="submit" disabled={busy || !newRank.trim() || ranks.length >= 10}>Add rank</button></form>}
        <p className="gang-muted">Manage gang lets a rank accept requests, kick, set ranks and edit the gang — but only for ranks below its own. New members join in the lowest rank.</p>
    </div>;

    const requests = gang && own && <ul className="gang-list">{!gang.requests.length && <p className="gang-muted">No open requests.</p>}{gang.requests.map(person => <li key={person.userId}>
        <span className="gang-portrait is-small" aria-hidden="true"><LayoutAvatarImageView className="gang-portrait-figure" figure={person.figure} gender={person.gender} direction={2} /></span>
        <div><strong>{person.username}</strong></div>
        <button type="button" disabled={busy} onClick={() => run(GangAction.Decline, { target: person.userId })}>Decline</button>
        <button type="button" className="gang-primary" disabled={busy || gang.memberCount >= (snapshot?.maxMembers ?? 0)} onClick={() => run(GangAction.Accept, { target: person.userId })}>Accept</button>
    </li>)}</ul>;

    const settings = gang && own && <div className="gang-settings">
        {gang.canManage && <section className="gang-panel"><h3>Edit gang</h3><GangForm key={gang.id} submitLabel="Save gang" busy={busy} initial={{ name: gang.name, description: gang.description }} onSubmit={json => run(GangAction.Edit, { value: json })} /></section>}
        {gang.isLeader ? <section className="gang-panel"><h3>Disband gang</h3><p className="gang-muted">Removes the gang and every membership. To leave instead, make another member Leader first (Members tab).</p>
            {confirm === 'disband' ? <form className="gang-search" onSubmit={event =>
            {
                event.preventDefault(); run(GangAction.Disband, { value: disbandName });
            }}><label><span className="gang-sr">Type the gang name</span><input placeholder={`Type ${gang.name}`} value={disbandName} onChange={event => setDisbandName(event.target.value)} /></label><button className="gang-danger" type="submit" disabled={busy || disbandName.trim().toLowerCase() !== gang.name.toLowerCase()}>Disband</button></form>
                : <button type="button" className="gang-danger" onClick={() =>
                {
                    setDisbandName('');
                    setConfirm('disband');
                }}>Disband gang…</button>}</section>
            : <section className="gang-panel"><h3>Leave gang</h3>{confirm === 'leave' ? <button type="button" className="gang-danger" disabled={busy} onClick={() => run(GangAction.Leave)}>Confirm: leave {gang.name}</button> : <button type="button" onClick={() => setConfirm('leave')}>Leave gang…</button>}</section>}
    </div>;

    return <VoltCardView theme="district" uniqueKey="district-gang" className="district-gang" isResizable={false} constrainToViewport>
        <div ref={panel} role="dialog" aria-labelledby={`${windowId}-title`} onKeyDown={event =>
        {
            if(event.key === 'Escape' && !event.defaultPrevented)
            {
                event.stopPropagation(); close();
            }
        }}>
            <header className="gang-titlebar drag-handler"><span id={`${windowId}-title`}>Gang</span><button type="button" className="gang-close" aria-label="Close Gang" onClick={close}>×</button></header>
            {gang && <div className="gang-banner">
                <div className="gang-banner-badge"><LayoutBadgeImageView badgeCode={gang.badge} isGroup showInfo={false} /></div>
                <div className="gang-banner-copy">
                    <h2>{gang.name}</h2>
                    <span className="gang-muted">Leader: {gang.leaderName} · {gang.memberCount} / {snapshot?.maxMembers} members</span>
                    {gang.description && <p>{gang.description}</p>}
                </div>
                <div className="gang-kd" aria-label={`Gang K/D ${killDeath(gang.kills, gang.deaths)}`}><strong>{killDeath(gang.kills, gang.deaths)}</strong><span>K/D</span><small>{gang.kills} kills · {gang.deaths} deaths</small></div>
            </div>}
            {gang && !own && <div className="gang-visit">
                {viewId !== 0 && <button type="button" onClick={() => setViewId(0)}>← Back</button>}
                {snapshot?.myGangId === 0 && (gang.requested
                    ? <button type="button" disabled={busy} onClick={() => run(GangAction.CancelRequest, { gangId: gang.id })}>Cancel request</button>
                    : <button type="button" className="gang-primary" disabled={busy || gang.memberCount >= (snapshot?.maxMembers ?? 0)} onClick={() => run(GangAction.RequestJoin, { gangId: gang.id })}>Ask to join</button>)}
            </div>}
            {gang && <div className="gang-tabs" role="tablist" aria-label="Gang sections">{tabs.map(id => <button type="button" key={id} id={`${windowId}-tab-${id}`} role="tab" aria-selected={current === id} aria-controls={`${windowId}-content`} onClick={() => setTab(id)}>
                {id === 'members' ? 'Members' : id === 'ranks' ? 'Ranks' : id === 'requests' ? `Requests (${gang.requests.length})` : 'Settings'}</button>)}</div>}
            <section id={`${windowId}-content`} role={gang ? 'tabpanel' : undefined} aria-labelledby={gang ? `${windowId}-tab-${current}` : undefined} className="gang-content" aria-busy={pending}>
                {error && <div className="gang-feedback" role="alert">{error}<button type="button" disabled={pending} onClick={refresh}>Refresh</button></div>}
                {snapshot?.message && <p className="gang-feedback" role="status">{snapshot.message}</p>}
                {!snapshot && !error && <p role="status" className="gang-muted">Loading…</p>}
                {landing}
                {current === 'members' && members}
                {current === 'ranks' && rankEditor}
                {current === 'requests' && requests}
                {current === 'settings' && settings}
            </section>
        </div>
    </VoltCardView>;
};
