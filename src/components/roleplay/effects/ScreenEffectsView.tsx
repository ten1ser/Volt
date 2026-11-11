import { FC, useEffect, useRef, useState } from 'react';
import './ScreenEffectsView.scss';

export type ScreenEffectFlashKind = 'hit' | 'heal';

interface ScreenEffectFlash
{
    id: number;
    kind: ScreenEffectFlashKind;
}

/** Which one-shot flash a Health change deserves; the first value never flashes. */
export const screenEffectFlash = (previous: number | null, next: number): ScreenEffectFlashKind | null =>
{
    if(previous === null) return null;
    if(next < previous) return 'hit';
    if(next > previous) return 'heal';
    return null;
};

const FLASH_MS = 800;

/** Own-screen Health states: hit and heal flashes, the low-Health pulse and the knocked-out wash. */
export const ScreenEffectsView: FC<{ health: number }> = ({ health }) =>
{
    const previousHealth = useRef<number | null>(null);
    const nextFlashId = useRef(0);
    const flashTimer = useRef(0);
    const [flash, setFlash] = useState<ScreenEffectFlash | null>(null);

    useEffect(() =>
    {
        const kind = screenEffectFlash(previousHealth.current, health);
        previousHealth.current = health;
        if(!kind) return;
        setFlash({ id: ++nextFlashId.current, kind });
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
    }, [health]);

    useEffect(() => () => window.clearTimeout(flashTimer.current), []);

    return (
        <>
            {health === 0 && <div className="rp-screen-fx rp-screen-fx--knocked-out" aria-hidden="true" />}
            {health > 0 && health <= 25 && <div className="rp-screen-fx rp-screen-fx--low" aria-hidden="true" />}
            {flash && (
                <div className="rp-screen-fx" aria-hidden="true">
                    <div key={flash.id} className={`rp-screen-fx__flash rp-screen-fx__flash--${ flash.kind }`} />
                </div>
            )}
        </>
    );
};
