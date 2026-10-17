import { CreateLinkEvent } from '@volt/renderer';
import { FC } from 'react';
import { localizeWithFallback } from '../../../api';
import { usePurse } from '../../../hooks';
import { useCityStatus } from '../../../hooks/roleplay/useCityStatus';
import { useRoom } from '../../../hooks/rooms/useRoom';
import { useNavigatorData } from '../../../hooks/navigator/useNavigatorData';
import { StatsHud } from '../stats/StatsHud';
import './DistrictHud.scss';

export const DistrictHud: FC = () =>
{
    const { purse } = usePurse();
    const { city } = useCityStatus();
    const { roomSession } = useRoom();
    const { navigatorData } = useNavigatorData();
    const room = navigatorData?.enteredGuestRoom;
    const roomName = roomSession
        ? (room?.roomId === roomSession.roomId ? room.roomName : 'Entering room…')
        : 'DistrictRP City';
    const phase = city?.isDay ? 'Day' : 'Night';
    const phaseTitle = city ? `${phase} · ${Math.ceil(city.phaseRemainingMs / 60000)} min left` : 'Synchronizing city time';

    return (
        <header className="district-hud-top" aria-label="DistrictRP player dashboard">
            <StatsHud />
            <div className="district-hud-brand" aria-label="DistrictRP">
                <span>DISTRICT<span>RP</span></span>
                <small>YOUR CITY. YOUR STORY.</small>
            </div>
            <section className="district-city" aria-label="City status">
                <div className="district-city__main">
                    <div className="district-city__clock" title={phaseTitle}>
                        <span className={`district-city__sky-icon ${city && !city.isDay ? 'is-night' : ''}`} aria-hidden="true">{city && !city.isDay ? '☾' : '☀'}</span>
                        <time aria-label="City time">{city?.time ?? '--:--'}</time>
                    </div>
                    <div className="district-city__coins" aria-label={localizeWithFallback('roleplay.currency.coins', 'RP Coins')} title="RP Coins">
                        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="M10 5v10M7 7h5M7 10h6M8 13h5" /></svg>
                        <strong>{(purse?.credits ?? 0).toLocaleString()}</strong>
                    </div>
                    <button type="button" aria-label="Settings" title="Settings" onClick={() => CreateLinkEvent('user-settings/show/other')}>
                        <span className="volt-icon icon-me-settings" aria-hidden="true" />
                    </button>
                </div>
                <div className="district-city__location">
                    <span className="district-city__room" title={roomName}>
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 15s5-5.5 5-9A5 5 0 0 0 3 6c0 3.5 5 9 5 9Z" /><circle cx="8" cy="6" r="1.5" /></svg>
                        <span>{roomName}</span>
                    </span>
                    <span className="district-city__online" title="Players online across the hotel" aria-label="Players online across the hotel">
                        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="4" r="3" /><path d="M2 14v-2a6 5 0 0 1 12 0v2Z" /></svg>
                        <span>{city ? city.onlinePlayers.toLocaleString() : '—'} online</span>
                    </span>
                </div>
            </section>
        </header>
    );
};
