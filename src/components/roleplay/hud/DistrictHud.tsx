import { FC } from 'react';
import clockIcon from '../../../assets/images/hc-center/clock.png';
import { useCityStatus } from '../../../hooks/roleplay/useCityStatus';
import { useRoom } from '../../../hooks/rooms/useRoom';
import { useNavigatorData } from '../../../hooks/navigator/useNavigatorData';
import { useRoomToolsMenuStore } from '../../room/widgets/room-tools/roomToolsMenuStore';
import { StatsHud } from '../stats/StatsHud';
import { TargetHud } from '../stats/TargetHud';
import './DistrictHud.scss';

// Phone-first HUD (layout C): only vitals (top left), clock and room name (top right) and the chat bar stay on screen;
// coins, online count and every tool live in the phone.
export const DistrictHud: FC = () =>
{
    const { city } = useCityStatus();
    const { roomSession } = useRoom();
    const { navigatorData } = useNavigatorData();
    const room = navigatorData?.enteredGuestRoom;
    const roomName = roomSession
        ? (room?.roomId === roomSession.roomId ? room.roomName : 'Entering room…')
        : 'DistrictRP City';
    const clockTitle = city ? `City time · ${city.isDay ? 'Day' : 'Night'}` : 'Synchronizing city time';
    const toolsOpen = useRoomToolsMenuStore(state => state.open);
    const toggleTools = useRoomToolsMenuStore(state => state.toggle);

    return (
        <>
            <div className="district-vitals">
                <StatsHud />
                <TargetHud />
            </div>
            <header className="district-topbar" aria-label="DistrictRP city status">
                <span className="district-clock" title={clockTitle}>
                    <img src={clockIcon} alt="" width={24} height={24} draggable={false} />
                    <time aria-label="City time">{city?.time ?? '--:--'}</time>
                </span>
                {roomSession
                    ? (
                        <button type="button" className="district-location is-menu" title={`${roomName} · room tools`} aria-haspopup="true" aria-expanded={toolsOpen} aria-controls="district-room-tools-menu" onClick={toggleTools}>
                            <span>{roomName}</span>
                            <svg className="district-location__chevron" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
                        </button>
                    )
                    : <div className="district-location" title={roomName}><span>{roomName}</span></div>}
            </header>
        </>
    );
};
