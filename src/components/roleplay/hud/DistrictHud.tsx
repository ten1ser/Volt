import { CreateLinkEvent } from '@volt/renderer';
import { FC } from 'react';
import wordmark from '../../../assets/images/loading/districtrp-wordmark.png';
import { localizeWithFallback } from '../../../api';
import { usePurse } from '../../../hooks';
import { useCityStatus } from '../../../hooks/roleplay/useCityStatus';
import { useRoom } from '../../../hooks/rooms/useRoom';
import { useNavigatorData } from '../../../hooks/navigator/useNavigatorData';
import './DistrictHud.scss';

export const DistrictHud: FC = () =>
{
    const { city } = useCityStatus();
    const { purse } = usePurse();
    const { roomSession } = useRoom();
    const { navigatorData } = useNavigatorData();
    const room = navigatorData?.enteredGuestRoom;
    const roomName = roomSession
        ? (room?.roomId === roomSession.roomId ? room.roomName : 'Entering room…')
        : 'DistrictRP City';
    const phase = city?.isDay ? 'Day' : 'Night';
    const phaseTitle = city ? `${phase} · ${Math.ceil(city.phaseRemainingMs / 60000)} min left` : 'Synchronizing city time';
    const coinLabel = localizeWithFallback('roleplay.currency.coins', 'RP Coins');

    return (
        <header className="district-topbar" aria-label="DistrictRP city status">
            <div className="district-brand">
                <img src={wordmark} alt="DistrictRP" width={2172} height={724} draggable={false} />
            </div>
            <div className="district-location" title={roomName}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 15s5-5.5 5-9A5 5 0 0 0 3 6c0 3.5 5 9 5 9Z" /><circle cx="8" cy="6" r="1.5" /></svg>
                <span>{roomName}</span>
            </div>
            <div className="district-city">
                <span className="district-city__clock" title={phaseTitle}>
                    <span className={`district-city__sky ${city && !city.isDay ? 'is-night' : ''}`} aria-hidden="true">{city && !city.isDay ? '☾' : '☀'}</span>
                    <time aria-label="City time">{city?.time ?? '--:--'}</time>
                </span>
                <span className="district-city__phase">{phaseTitle}</span>
                <span className="district-city__coins" title={coinLabel} aria-label={coinLabel}>
                    <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="M10 5v10M7 7h5M7 10h6M8 13h5" /></svg>
                    <strong>{(purse?.credits ?? 0).toLocaleString()}</strong>
                </span>
                <span className="district-city__online" title="Players online across the hotel" aria-label="Players online across the hotel">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="4" r="3" /><path d="M2 14v-2a6 5 0 0 1 12 0v2Z" /></svg>
                    <span>{city ? city.onlinePlayers.toLocaleString() : '—'} online</span>
                </span>
                <button type="button" aria-label="Settings" title="Settings" onClick={() => CreateLinkEvent('user-settings/show/other')}>
                    <span className="volt-icon icon-me-settings" aria-hidden="true" />
                </button>
            </div>
        </header>
    );
};
