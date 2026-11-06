import { CSSProperties, FC, useLayoutEffect, useRef, useState } from 'react';
import wordmark from '../../../assets/images/roleplay/districtrp-logo-hud.png';
import moonIcon from '../../../assets/images/roleplay/phone/moon.png';
import sunIcon from '../../../assets/images/roleplay/phone/sun.png';
import roomIcon from '../../../assets/images/roleplay/room-icon.svg';
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

// Matches the 208px .district-player-card host width.
const PLAYER_CARD_WIDTH = 208;

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
    const vitalsRef = useRef<HTMLDivElement>(null);
    const [cardPosition, setCardPosition] = useState<{ left: number; otherLeft: number; top: number; maxHeight: number } | null>(null);

    // The player cards are portalled here so they sit below the whole vitals stack and never inherit the desktop 1.25 scale.
    useLayoutEffect(() =>
    {
        const vitals = vitalsRef.current;

        if (!vitals) return;

        const measure = () =>
        {
            const rect = vitals.getBoundingClientRect();
            const top = rect.bottom + 10;
            const maxHeight = Math.max(0, window.innerHeight - top - 16);
            const target = vitals.querySelector('.rp-target-hud')?.getBoundingClientRect();
            // The other card goes under the target HUD when it sits beside yours; otherwise (no target, or the narrow
            // stacked layout) it sits one card width to the right of your card.
            // shortcut: below ~420px wide the two cards overlap; stack them vertically if phones become a target.
            const otherLeft = target && target.left >= rect.left + PLAYER_CARD_WIDTH ? target.left : rect.left + PLAYER_CARD_WIDTH + 10;

            setCardPosition(previous =>
            {
                if (previous && previous.left === rect.left && previous.otherLeft === otherLeft && previous.top === top && previous.maxHeight === maxHeight) return previous;

                return { left: rect.left, otherLeft, top, maxHeight };
            });
        };

        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);

        observer?.observe(vitals);
        window.addEventListener('resize', measure);
        measure();

        return () =>
        {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    const cardStyle = (left: number): CSSProperties | undefined => cardPosition
        ? ({ left: `${left}px`, top: `${cardPosition.top}px`, maxHeight: `${cardPosition.maxHeight}px`, '--district-card-left': `${left}px`, '--district-card-max-height': `${cardPosition.maxHeight}px` } as CSSProperties)
        : undefined;

    return (
        <>
            <div className="district-vitals" ref={vitalsRef}>
                <StatsHud />
                <TargetHud />
            </div>
            <div id="district-player-card" className="district-player-card" style={cardStyle(cardPosition?.left ?? 0)} />
            <div id="district-target-card" className="district-player-card" style={cardStyle(cardPosition?.otherLeft ?? 0)} />
            <img className="district-wordmark" src={wordmark} alt="DistrictRP" width={160} height={45} draggable={false} />
            {/* Minimal corner (option C, 2026-11-04): the room name as plain text over a small brass time chip. */}
            <header className="district-topbar" aria-label="DistrictRP city status">
                {roomSession
                    ? (
                        <button type="button" className="district-location is-menu" title={`${roomName} · room tools`} aria-haspopup="true" aria-expanded={toolsOpen} aria-controls="district-room-tools-menu" onClick={toggleTools}>
                            <img className="district-location__icon" src={roomIcon} alt="" width={24} height={24} aria-hidden="true" draggable={false} />
                            <span className="district-location__label">{shownName}</span>
                            <svg className="district-location__chevron" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
                        </button>
                    )
                    : <div className="district-location" title={roomName}><img className="district-location__icon" src={roomIcon} alt="" width={24} height={24} aria-hidden="true" draggable={false} /><span className="district-location__label">{shownName}</span></div>}
                <span className="district-clock" title={clockTitle}>
                    {city && <img src={city.isDay ? sunIcon : moonIcon} alt="" width={16} height={16} draggable={false} />}
                    <time aria-label="City time">{city?.time ?? '--:--'}</time>
                </span>
            </header>
        </>
    );
};
