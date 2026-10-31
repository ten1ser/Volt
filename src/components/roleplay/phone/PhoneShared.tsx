import { FC, ReactNode } from 'react';
import phoneAppIcon from '../../../assets/images/roleplay/phone/apps/phone.png';
import messagesAppIcon from '../../../assets/images/roleplay/phone/apps/messages.png';
import friendsAppIcon from '../../../assets/images/roleplay/phone/apps/friends.png';
import businessAppIcon from '../../../assets/images/roleplay/phone/apps/business.png';
import gangAppIcon from '../../../assets/images/roleplay/phone/apps/gang.png';
import backpackAppIcon from '../../../assets/images/roleplay/phone/apps/backpack.png';
import roomsAppIcon from '../../../assets/images/roleplay/phone/apps/rooms.png';
import inventoryAppIcon from '../../../assets/images/roleplay/phone/apps/inventory.png';
import shopAppIcon from '../../../assets/images/roleplay/phone/apps/shop.png';
import cameraAppIcon from '../../../assets/images/roleplay/phone/apps/camera.png';
import modtoolsAppIcon from '../../../assets/images/roleplay/phone/apps/modtools.png';
import wiredAppIcon from '../../../assets/images/roleplay/phone/apps/wired.png';
import buildAppIcon from '../../../assets/images/roleplay/phone/apps/build.png';
import gamesAppIcon from '../../../assets/images/roleplay/phone/apps/games.png';
import storiesAppIcon from '../../../assets/images/roleplay/phone/apps/stories.png';
import helperAppIcon from '../../../assets/images/roleplay/phone/apps/helper.png';
import settingsAppIcon from '../../../assets/images/roleplay/phone/apps/settings.png';
import { LayoutAvatarImageView } from '../../../common/layout/LayoutAvatarImageView';

const glyph = (src: string) => <img className="district-phone__app-art" src={src} width={48} height={48} alt="" draggable={false} />;

export const PHONE_GLYPHS = {
    phone: glyph(phoneAppIcon),
    messages: glyph(messagesAppIcon),
    friends: glyph(friendsAppIcon),
    business: glyph(businessAppIcon),
    gang: glyph(gangAppIcon),
    backpack: glyph(backpackAppIcon),
    rooms: glyph(roomsAppIcon),
    inventory: glyph(inventoryAppIcon),
    shop: glyph(shopAppIcon),
    camera: glyph(cameraAppIcon),
    modtools: glyph(modtoolsAppIcon),
    wired: glyph(wiredAppIcon),
    build: glyph(buildAppIcon),
    games: glyph(gamesAppIcon),
    stories: glyph(storiesAppIcon),
    helper: glyph(helperAppIcon),
    settings: glyph(settingsAppIcon)
};

/** Round head portrait; group chats (negative ids) and missing figures fall back to the name's initial. */
export const PhoneAvatar: FC<{ figure: string; name: string; size?: number; online?: boolean; isGroup?: boolean }> = ({ figure, name, size = 36, online = false, isGroup = false }) => (
    <span className={`district-phone__avatar ${online ? 'is-online' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
        {figure && !isGroup
            ? <LayoutAvatarImageView figure={figure} headOnly compactHead compactHeadSize={size} compactHeadPadding={0} direction={2} />
            : <span className="district-phone__initial">{(name || '?').charAt(0).toUpperCase()}</span>}
    </span>
);

/** App title bar: optional back chevron, centred title, optional trailing action. */
export const PhoneHeader: FC<{ title: ReactNode; backLabel?: string; onBack?: () => void; action?: ReactNode }> = ({ title, backLabel = 'Back', onBack, action }) => (
    <header className="district-phone__header">
        {onBack ? <button type="button" className="district-phone__back" aria-label={backLabel} onClick={onBack}>‹</button> : <span />}
        <h2>{title}</h2>
        {action ?? <span />}
    </header>
);

/** Shown instead of a SIM-only app (Messages, Friends) while the phone has no SIM card. */
export const PhoneNoSim: FC<{ title: string; onHome: () => void }> = ({ title, onHome }) => (
    <div className="district-phone__app-screen">
        <PhoneHeader title={title} backLabel="Home" onBack={onHome} />
        <div className="district-phone__no-sim-screen">
            <strong>No SIM card</strong>
            <p>{title} needs a SIM card. Buy one from a store to get your own number.</p>
        </div>
    </div>
);

/** "13:40" for today, otherwise a short weekday. */
export const phoneTime = (date: Date, now = new Date()) =>
    date.toDateString() === now.toDateString()
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : date.toLocaleDateString([], { weekday: 'short' });
