import { FC, useEffect, useState } from 'react';
import wordmark from '@/assets/images/loading/districtrp-wordmark.png';

// DistrictRP client loading screen (75_classic-js HabboAirLauncher: eSe + JRe).

// default_localizations_en client.starting.revolving
const REVOLVING_MESSAGES = [
    'For science, you monster',
    'Loading funny message…please wait.',
    'Would you like fries with that?',
    'Follow the yellow duck.',
    'Time is just an illusion.',
    'Are we there yet?!',
    'I like your t-shirt.',
    'Look left. Look right. Blink twice. Ta da!',
    "It's not you, it's me.",
    "Shhh! I'm trying to think here.",
    'Loading pixel universe.'
];

const BAR_TICK_MS = 750;

// The loading screen opens once the bootstrap is done, so real progress fills the last 40%.
const BOOTSTRAP_PROGRESS = 0.6;

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

interface LoadingViewProps {
    backToHotelUrl?: string;
    isError?: boolean;
    message?: string;
    progress?: number;
}

export const LoadingView: FC<LoadingViewProps> = (props) => {
    const { backToHotelUrl, isError = false, message = '', progress = 0 } = props;
    const [firstMessageIndex] = useState(() => randomBetween(0, REVOLVING_MESSAGES.length - 1));
    const [messageIndex, setMessageIndex] = useState(firstMessageIndex);
    const [barProgress, setBarProgress] = useState<number | null>(null);

    useEffect(() => {
        if (isError) return;

        // The bar is decorative: it fills in random steps, holds full for one tick, then restarts with the next message.
        let value = 0;
        let swapMessage = false;
        let nextIndex = firstMessageIndex;

        const interval = window.setInterval(() => {
            if (value === 100) {
                if (swapMessage) {
                    setMessageIndex(nextIndex);
                    swapMessage = false;
                }

                value = 0;
            } else {
                value += Math.min(randomBetween(35, Math.min(randomBetween(45, 55), 100 - value)), 100 - value);
            }

            if (value === 100) {
                swapMessage = true;
                nextIndex = (nextIndex + 1) % (REVOLVING_MESSAGES.length - 1);
            }

            setBarProgress(value / 100);
        }, BAR_TICK_MS);

        return () => window.clearInterval(interval);
    }, [isError, firstMessageIndex]);

    const percent = Math.round(Math.min(1, BOOTSTRAP_PROGRESS + (Math.max(0, Math.min(100, progress)) / 100) * (1 - BOOTSTRAP_PROGRESS)) * 100);

    return (
        <div className={isError
            ? `classic-loading-screen classic-loading-screen--error${backToHotelUrl ? ' classic-loading-screen--recoverable' : ''}`
            : 'classic-loading-screen'}>
            <img
                className="classic-loading-screen__logo"
                src={wordmark}
                alt="DistrictRP"
                width={2172}
                height={724}
                draggable={false}
            />
            <div className="classic-loading-screen__text">{isError ? 'Loading failed' : REVOLVING_MESSAGES[messageIndex]}</div>
            <div className="classic-loading-screen__bar">
                {barProgress !== null && (
                    <div
                        className="classic-loading-screen__bar-fill"
                        style={{ width: `${Math.round((barProgress ?? 0) * 100)}%` }}
                    >
                        <span className="classic-loading-screen__bar-top" />
                        <span className="classic-loading-screen__bar-bottom" />
                    </div>
                )}
            </div>
            {!isError && <div className="classic-loading-screen__percent">{percent}%</div>}
            {isError && <div className="classic-loading-screen__error">{message}</div>}
            {isError && backToHotelUrl && (
                <a className="classic-loading-screen__back" href={backToHotelUrl}>Back to Hotel</a>
            )}
        </div>
    );
};
