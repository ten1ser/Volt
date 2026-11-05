import { FC, useEffect, useState } from 'react';
import wordmark from '@/assets/images/loading/districtrp-logo.png';

// DistrictRP client loading screen.

const REVOLVING_MESSAGES = [
    'Unlocking the front door…',
    'Waking up the district…',
    'Checking who is on shift…',
    'Turning on the street lamps…',
    'Sweeping the pavement…',
    'Topping up the vending machines…',
    'Tuning the radios…'
];

const MESSAGE_MS = 2400;

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
    const [messageIndex, setMessageIndex] = useState(() => randomBetween(0, REVOLVING_MESSAGES.length - 1));

    useEffect(() => {
        if (isError) return;

        const interval = window.setInterval(() => setMessageIndex(index => (index + 1) % REVOLVING_MESSAGES.length), MESSAGE_MS);

        return () => window.clearInterval(interval);
    }, [isError]);

    const percent = Math.round(Math.min(1, BOOTSTRAP_PROGRESS + (Math.max(0, Math.min(100, progress)) / 100) * (1 - BOOTSTRAP_PROGRESS)) * 100);

    return (
        <div className={isError
            ? `classic-loading-screen classic-loading-screen--error${backToHotelUrl ? ' classic-loading-screen--recoverable' : ''}`
            : 'classic-loading-screen'}>
            <img
                className="classic-loading-screen__logo"
                src={wordmark}
                alt="DistrictRP"
                width={1040}
                height={288}
                draggable={false}
            />
            <div className="classic-loading-screen__text" aria-live="polite">{isError ? 'Loading failed' : REVOLVING_MESSAGES[messageIndex]}</div>
            {!isError && (
                <div
                    className="classic-loading-screen__progress"
                    role="progressbar"
                    aria-label="Loading"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                >
                    <div className="classic-loading-screen__bar">
                        <div className="classic-loading-screen__bar-fill" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="classic-loading-screen__percent">{percent}%</div>
                </div>
            )}
            {isError && <div className="classic-loading-screen__error">{message}</div>}
            {isError && backToHotelUrl && (
                <a className="classic-loading-screen__back" href={backToHotelUrl}>Back to Hotel</a>
            )}
        </div>
    );
};
