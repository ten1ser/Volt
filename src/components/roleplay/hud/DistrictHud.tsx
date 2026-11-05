import { FC } from 'react';
import wordmark from '../../../assets/images/roleplay/districtrp-logo-hud.png';
import moonIcon from '../../../assets/images/roleplay/phone/moon.png';
import sunIcon from '../../../assets/images/roleplay/phone/sun.png';
import { useCityStatus } from '../../../hooks/roleplay/useCityStatus';
import { useDistrictWindowKeys } from '../../../hooks/roleplay/useDistrictWindowKeys';
import { useRoom } from '../../../hooks/rooms/useRoom';
import { useNavigatorData } from '../../../hooks/navigator/useNavigatorData';
import { useRoomToolsMenuStore } from '../../room/widgets/room-tools/roomToolsMenuStore';
import { StatsHud } from '../stats/StatsHud';
import { TargetHud } from '../stats/TargetHud';
import './DistrictHud.scss';

// Room names carry a "[HOSP] " style tag for the navigator; the HUD shows the plain name and keeps the full one as a tooltip.
export const displayRoomName = (name: string) => name.replace(/^\s*\[[^\]]*\]\s*/, '') || name;

// Phone-first HUD (layout C): only vitals (top left), the wordmark (top centre), clock and room name (top right) and the
// chat bar stay on screen; coins, online count and every tool live in the phone.
export const DistrictHud: FC = () =>
{
    const { city } = useCityStatus();
    const { roomSession } = useRoom();
    const { navigatorData } = useNavigatorData();
    const room = navigatorData?.enteredGuestRoom;
    const roomName = roomSession
        ? (room?.roomId === roomSession.roomId ? room.roomName : 'Entering room…')
        : 'DistrictRP City';
    const shownName = displayRoomName(roomName);
    const clockTitle = city ? 'City time' : 'Synchronizing city time';
    const toolsOpen = useRoomToolsMenuStore(state => state.open);
    const toggleTools = useRoomToolsMenuStore(state => state.toggle);
    useDistrictWindowKeys();

    return (
        <>
            <div className="district-vitals">
                <StatsHud />
                <TargetHud />
            </div>
            <img className="district-wordmark" src={wordmark} alt="DistrictRP" width={160} height={45} draggable={false} />
            {/* Minimal corner (option C, 2026-11-04): the room name as plain text over a small brass time chip. */}
            <header className="district-topbar" aria-label="DistrictRP city status">
                {roomSession
                    ? (
                        <button type="button" className="district-location is-menu" title={`${roomName} · room tools`} aria-haspopup="true" aria-expanded={toolsOpen} aria-controls="district-room-tools-menu" onClick={toggleTools}>
                            <span>{shownName}</span>
                            <svg className="district-location__chevron" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
                        </button>
                    )
                    : <div className="district-location" title={roomName}><span>{shownName}</span></div>}
                <span className="district-clock" title={clockTitle}>
                    {city && <img src={city.isDay ? sunIcon : moonIcon} alt="" width={16} height={16} draggable={false} />}
                    <time aria-label="City time">{city?.time ?? '--:--'}</time>
                </span>
            </header>
        </>
    );
};
