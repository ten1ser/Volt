import { FC, ReactNode } from 'react';
import { LayoutAvatarImageView } from '../../../common/layout/LayoutAvatarImageView';

const glyph = (path: ReactNode) => <svg viewBox="0 0 24 24" aria-hidden="true">{path}</svg>;

export const PHONE_GLYPHS = {
    phone: glyph(<path d="M7 3h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2L21 14v3a2 2 0 0 1-2 2C10.7 19 5 13.3 5 5a2 2 0 0 1 2-2Z" />),
    messages: glyph(<path d="M4 5h16v11H9l-5 4Z" />),
    friends: glyph(<><circle cx="9" cy="8" r="3.2" /><circle cx="16.5" cy="9" r="2.6" /><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5Zm12.5 0c0-2-.6-3.6-1.8-4.7 2.9-.4 5.3 1.4 5.3 4.7Z" /></>),
    inventory: glyph(<path d="M4 8l8-4 8 4v9l-8 4-8-4Zm8 1.6L6.4 7 12 4.4 17.6 7Z" />),
    shop: glyph(<path d="M6 8h12l-1 12H7Zm3 0a3 3 0 0 1 6 0h-1.6a1.4 1.4 0 0 0-2.8 0Z" />),
    camera: glyph(<path d="M8.5 5h7l1.5 2H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3Zm3.5 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />),
    modtools: glyph(<path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6Zm-1 5v5h2V8Zm0 6v2h2v-2Z" />),
    wired: glyph(<path d="M13 3 6 13h5l-1 8 8-11h-5l1-7Z" />),
    build: glyph(<path d="M4 18h16v2H4Zm2-4h12v3H6Zm2-4h8v3H8Zm2-4h4v3h-4Z" />),
    games: glyph(<path d="M7 8h10a4 4 0 0 1 4 4v3a3 3 0 0 1-5.4 1.8L14.5 15h-5l-1.1 1.8A3 3 0 0 1 3 15v-3a4 4 0 0 1 4-4Zm0 2.5v1.5H5.5v1.5H7V15h1.5v-1.5H10V12H8.5v-1.5Zm8.5.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />),
    stories: glyph(<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4Zm3 3v2h8V7Zm0 4v2h8v-2Z" />),
    helper: glyph(<path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-6.2 1.6 2.4 1.3M18.2 8.6l-2.4 1.3" />),
    settings: glyph(<path d="M10.6 3h2.8l.5 2.4 1.7.8 2.1-1.3 2 2-1.3 2.1.8 1.7 2.4.5v2.8l-2.4.5-.8 1.7 1.3 2.1-2 2-2.1-1.3-1.7.8-.5 2.4h-2.8l-.5-2.4-1.7-.8-2.1 1.3-2-2 1.3-2.1-.8-1.7L3 13.4v-2.8l2.4-.5.8-1.7-1.3-2.1 2-2 2.1 1.3 1.7-.8ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />)
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
