import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneSettingsApp } from './PhoneSettingsApp';

const test = vi.hoisted(() => ({
    settings: { volumeSystem: 40, volumeFurni: 60, volumeTrax: 80, roomInvites: false, cameraFollow: false },
    chat: { chatMode: 0, chatBubbleWidth: 1, chatScrollSpeed: 1 },
    action: vi.fn(), commit: vi.fn(), online: vi.fn(), chatUpdate: vi.fn(), reset: vi.fn(), share: vi.fn()
}));
vi.mock('../../../hooks/roleplay/useRpPhone', () => ({
    useRpPhone: () => ({ status: { hasSim: true, number: '+12-345-6', load: 14, shareLocation: false }, notice: null, clearNotice: vi.fn(), factoryReset: test.reset, setSharing: test.share })
}));
vi.mock('../../../api', () => ({ GetConfigurationValue: () => true }));
vi.mock('../../../hooks/useUserSettings', () => ({
    useUserSettings: () => ({ userSettings: test.settings, onlineIndicatorPreference: 0, processAction: test.action, commitVolumes: test.commit, saveOnlineIndicator: test.online })
}));
vi.mock('../../../hooks/useChatPreferences', () => ({ useChatPreferences: () => ({ chatPreferences: test.chat, updateChatPreferences: test.chatUpdate }) }));

describe('Phone Settings app', () =>
{
    beforeEach(() =>
    {
        [test.action, test.commit, test.online, test.chatUpdate, test.reset, test.share].forEach(fn => fn.mockClear());
        vi.useFakeTimers();
    });
    afterEach(() =>
    {
        cleanup(); vi.useRealTimers();
    });

    it('toggles do not disturb and camera follow', () =>
    {
        const onDnd = vi.fn();
        render(<PhoneSettingsApp doNotDisturb={false} onDoNotDisturb={onDnd} onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('switch', { name: 'Do not disturb' }));
        expect(onDnd).toHaveBeenCalledWith(true);
        fireEvent.click(screen.getByRole('switch', { name: /focus on my avatar/ }));
        expect(test.action).toHaveBeenCalledWith('camera_follow', true);
    });

    it('shows the SIM card and Load, and factory resets only after RESET is typed', () =>
    {
        render(<PhoneSettingsApp doNotDisturb={false} onDoNotDisturb={vi.fn()} onHome={vi.fn()} />);
        expect(screen.getByText('+12-345-6')).toBeInTheDocument();
        expect(screen.getByText('14')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Factory reset' }));
        const erase = screen.getByRole('button', { name: 'Erase phone' });
        expect(erase).toBeDisabled();
        fireEvent.change(screen.getByRole('textbox', { name: 'Type RESET to confirm' }), { target: { value: 'reset' } });
        fireEvent.click(erase);
        expect(test.reset).toHaveBeenCalledWith('RESET');
    });

    it('changes volume live and saves it once the slider settles', () =>
    {
        render(<PhoneSettingsApp doNotDisturb={false} onDoNotDisturb={vi.fn()} onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Sound/ }));
        fireEvent.change(screen.getByRole('slider', { name: 'System volume' }), { target: { value: '55' } });
        expect(test.action).toHaveBeenCalledWith('system_volume', 55);
        expect(test.commit).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(700));
        expect(test.commit).toHaveBeenCalledTimes(1);
    });

    it('saves chat, invite and friend-alert choices', () =>
    {
        render(<PhoneSettingsApp doNotDisturb={false} onDoNotDisturb={vi.fn()} onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Line by line' }));
        expect(test.chatUpdate).toHaveBeenCalledWith({ chatMode: 1, chatBubbleWidth: 1, chatScrollSpeed: 1 });
        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Ignore room invites' }));
        expect(test.action).toHaveBeenCalledWith('room_invites', true);
        fireEvent.click(screen.getByRole('radio', { name: 'Nobody' }));
        expect(test.online).toHaveBeenCalledWith(2);
    });

    it('turns location sharing on for friends', () =>
    {
        render(<PhoneSettingsApp doNotDisturb={false} onDoNotDisturb={vi.fn()} onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('switch', { name: 'Share my location with friends' }));
        expect(test.share).toHaveBeenCalledWith(true);
    });
});
