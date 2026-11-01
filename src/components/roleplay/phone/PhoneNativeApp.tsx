import { useRef, useState } from 'react';
import { WindowHost } from '../../../common/draggable-window/WindowHost';

export const PHONE_WINDOWS = {
    gang: { label: 'Gang', keys: ['district-gang'], hide: 'gangs/hide' },
    rooms: { label: 'Rooms', keys: ['navigator', 'navigator-room-creator', 'volt-room-settings', 'volt-room-settings-confirm'], hide: 'navigator/hide' },
    inventory: { label: 'Inventory', keys: ['inventory', 'inventory-delete', 'marketplace-offer'], hide: 'inventory/hide' },
    shop: { label: 'Shop', keys: ['catalog', 'targeted-offer', 'catalog-purchase-confirm', 'catalog-club-confirm', 'catalog-gift', 'marketplace-offer'], hide: 'catalog/hide' },
    modtools: { label: 'Moderation', keys: ['phone-mod-start'], prefixes: ['phone-mod-'], hide: 'mod-tools/hide' },
    wired: { label: 'Wired', keys: ['wired-creator-tools', 'wired-monitor-history', 'wired-monitor-info', 'wired-monitor-error-info'], hide: 'wired-tools/hide' },
    build: { label: 'Build height', keys: ['build-height'] },
    games: { label: 'Games', keys: ['snowwar-games-main', 'snowwar-leaderboard'] },
    helper: { label: 'Helper', keys: ['guide-tool'] },
    // No Stories view or stories/ tracker exists in this client; keep an honest unavailable state.
    stories: { label: 'Stories', keys: [] }
} as const;

export type NativePhoneApp = keyof typeof PHONE_WINDOWS;
export const isNativePhoneApp = (id: string): id is NativePhoneApp => Object.hasOwn(PHONE_WINDOWS, id);

export const PhoneNativeApp = ({ id, active, onHome, onRetry, onReady }: {
    id: NativePhoneApp; active: boolean; onHome: () => void; onRetry: () => void; onReady: () => void;
}) =>
{
    const spec = PHONE_WINDOWS[id];
    const windows = useRef(new Set<string>());
    const [present, setPresent] = useState(false);
    const [seen, setSeen] = useState(false);
    return <div className="district-phone__app-container district-phone__native-app" data-phone-app={id} hidden={!active} inert={!active}>
        <header className="district-phone__app-header"><button type="button" onClick={onHome} aria-label="Back to apps">‹ Apps</button><h2>{spec.label}</h2></header>
        <WindowHost id={`phone-${id}`} keys={spec.keys} active={active} prefixes={'prefixes' in spec ? spec.prefixes : []} onReady={onReady} onEscape={onHome} onPresent={(key, mounted) =>
        {
            if (mounted) windows.current.add(key);
            else windows.current.delete(key);
            setPresent(windows.current.size > 0);
            if (mounted) setSeen(true);
        }}>
            {!present && <div className="district-phone__app-empty" role="status">
                <strong>{id === 'stories' ? 'Stories is unavailable' : seen ? `${spec.label} is closed` : `Opening ${spec.label}…`}</strong>
                <p>{id === 'stories' ? 'This client does not have a Stories app yet.' : 'Use Reopen if the app has not appeared.'}</p>
                {id !== 'stories' && <button type="button" onClick={onRetry}>Reopen {spec.label}</button>}
            </div>}
        </WindowHost>
    </div>;
};
