import { FC, useEffect, useState } from 'react';
import { PhoneCallRecord, useRpPhone } from '../../../hooks/roleplay/useRpPhone';
import { PhoneHeader } from './PhoneShared';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '-'];
const MAX_LENGTH = 12;

type Tab = 'keypad' | 'recents';

/** "now", "5m", "3h" or "2d" since a call. */
export const callAgo = (seconds: number) =>
    seconds < 60 ? 'now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h` : `${Math.floor(seconds / 86400)}d`;

/** A call's length as m:ss. */
export const callLength = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const describe = (call: PhoneCallRecord) =>
    !call.answered ? (call.outgoing ? 'No answer' : 'Missed') : `${call.outgoing ? 'Outgoing' : 'Incoming'} · ${callLength(call.durationSeconds)}`;

/** Phone app: a keypad that dials +XX-XXX-X numbers and the free hospital and police lines, and the SIM card's recent calls. */
export const PhoneDialerApp: FC<{ onHome: () => void }> = ({ onHome }) =>
{
    const { status, dial, callNotice, clearCallNotice, history, loadHistory } = useRpPhone();
    const [number, setNumber] = useState('');
    const [tab, setTab] = useState<Tab>('keypad');
    const hasSim = !!status?.hasSim;
    const type = (key: string) =>
    {
        clearCallNotice();
        setNumber(current => (current.length < MAX_LENGTH ? current + key : current));
    };
    const call = (value: string) =>
    {
        if (value.trim().length) dial(value.trim());
    };

    // Opening Recents asks the server; the list arrives as its own packet.
    useEffect(() =>
    {
        if (tab === 'recents' && hasSim) loadHistory();
    }, [tab, hasSim, loadHistory]);

    return (
        <div className="district-phone__app-screen is-dialer">
            <PhoneHeader title="Phone" backLabel="Home" onBack={onHome} />
            <div className="district-phone__segments" role="tablist" aria-label="Phone">
                <button type="button" role="tab" aria-selected={tab === 'keypad'} className={tab === 'keypad' ? 'is-active' : ''} onClick={() => setTab('keypad')}>Keypad</button>
                <button type="button" role="tab" aria-selected={tab === 'recents'} className={tab === 'recents' ? 'is-active' : ''} onClick={() => setTab('recents')}>Recents</button>
            </div>
            {status && !hasSim && <p className="district-phone__sim-warning">No SIM card. Only emergency calls work. Buy a SIM card from a store.</p>}
            <p className="district-phone__dial-notice" role="status">{callNotice}</p>
            {tab === 'recents'
                ? <ul className="district-phone__list" aria-label="Recent calls">
                    {hasSim && history?.map((entry, index) => (
                        <li key={index} className="district-phone__row-wrap">
                            <span className={`district-phone__row ${entry.answered ? '' : 'is-missed'}`}>
                                <span className="district-phone__call-direction" aria-hidden="true">{entry.outgoing ? '↗' : '↙'}</span>
                                <span className="district-phone__row-text"><strong>{entry.peerName}</strong><small>{entry.peerNumber} · {describe(entry)}</small></span>
                                <small className="district-phone__call-ago">{callAgo(entry.agoSeconds)}</small>
                            </span>
                            <button type="button" className="district-phone__row-action" aria-label={`Call ${entry.peerName}`} onClick={() => call(entry.peerNumber)}>✆</button>
                        </li>
                    ))}
                    {hasSim && history && !history.length && <li className="district-phone__empty">No calls yet.</li>}
                    {!hasSim && <li className="district-phone__empty">Recent calls need a SIM card.</li>}
                </ul>
                : <>
                    <input
                        className="district-phone__dial-number"
                        value={number}
                        inputMode="tel"
                        maxLength={MAX_LENGTH}
                        placeholder="+12-345-6"
                        aria-label="Number to call"
                        onChange={event =>
                        {
                            clearCallNotice();
                            setNumber(event.target.value.replace(/[^\d+\- ]/g, '').slice(0, MAX_LENGTH));
                        }}
                        onKeyDown={event =>
                        {
                            if (event.key === 'Enter') call(number);
                        }} />
                    <div className="district-phone__keypad">
                        {KEYS.map(key => <button type="button" key={key} className="district-phone__key" onClick={() => type(key)}>{key}</button>)}
                    </div>
                    <div className="district-phone__dial-actions">
                        <button type="button" className="district-phone__call-button is-call" aria-label="Call" disabled={!number.trim()} onClick={() => call(number)}>✆</button>
                        <button type="button" className="district-phone__key-erase" aria-label="Delete digit" disabled={!number} onClick={() => setNumber(current => current.slice(0, -1))}>⌫</button>
                    </div>
                    {status && (
                        <div className="district-phone__emergency">
                            <button type="button" className="district-phone__pill" onClick={() => call(status.hospitalNumber)}>Hospital {status.hospitalNumber}</button>
                            <button type="button" className="district-phone__pill" onClick={() => call(status.policeNumber)}>Police {status.policeNumber}</button>
                        </div>
                    )}
                    {hasSim && <p className="district-phone__dial-hint">Calls cost {status.callCost} Load every {status.callPeriodSeconds} seconds. You have {status.load} Load.</p>}
                </>}
        </div>
    );
};
