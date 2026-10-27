import { FC, ReactNode } from 'react';
import { LayoutAvatarImageView } from '../../../common/layout/LayoutAvatarImageView';

const glyph = (path: ReactNode) => <svg viewBox="0 0 24 24" aria-hidden="true">{path}</svg>;

export const PHONE_GLYPHS = {
    messages: glyph(<path d="M4 5h16v11H9l-5 4Z" />),
    friends: glyph(<><circle cx="9" cy="8" r="3.2" /><circle cx="16.5" cy="9" r="2.6" /><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5Zm12.5 0c0-2-.6-3.6-1.8-4.7 2.9-.4 5.3 1.4 5.3 4.7Z" /></>),
    inventory: glyph(<path d="M4 8l8-4 8 4v9l-8 4-8-4Zm8 1.6L6.4 7 12 4.4 17.6 7Z" />),
    shop: glyph(<path d="M6 8h12l-1 12H7Zm3 0a3 3 0 0 1 6 0h-1.6a1.4 1.4 0 0 0-2.8 0Z" />),
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

/** "13:40" for today, otherwise a short weekday. */
export const phoneTime = (date: Date, now = new Date()) =>
    date.toDateString() === now.toDateString()
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : date.toLocaleDateString([], { weekday: 'short' });
