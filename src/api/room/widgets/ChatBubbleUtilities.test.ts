import { GetAvatarRenderManager } from '@volt/renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatBubbleUtilities } from './ChatBubbleUtilities';
vi.mock('../../volt/GetConfigurationValue', () => ({ GetConfigurationValue: () => false }));
afterEach(() => {
    vi.restoreAllMocks();
    ChatBubbleUtilities.AVATAR_IMAGE_CACHE.clear();
    ChatBubbleUtilities.AVATAR_COLOR_CACHE.clear();
});

it('retains 1000 speakers and touches hot heads and colours together', async () => {
    for (let i = 0; i < 1000; i++) {
        ChatBubbleUtilities.AVATAR_IMAGE_CACHE.set(`low:normal:figure-${i}`, `image-${i}`);
        ChatBubbleUtilities.AVATAR_COLOR_CACHE.set(`figure-${i}`, i);
    }
    const render = vi.spyOn(ChatBubbleUtilities, 'setFigureImage');
    for (let i = 0; i < 1000; i++) expect(await ChatBubbleUtilities.getUserImage(`figure-${i}`)).toBe(`image-${i}`);
    await ChatBubbleUtilities.getUserImage('figure-0');
    expect([...ChatBubbleUtilities.AVATAR_IMAGE_CACHE.keys()].at(-1)).toBe('low:normal:figure-0');
    expect([...ChatBubbleUtilities.AVATAR_COLOR_CACHE.keys()].at(-1)).toBe('figure-0');
    expect(render).not.toHaveBeenCalled();
});

it('coalesces concurrent head rendering while keeping resolution variants distinct', async () => {
    let finish: (value: string) => void;
    const render = vi.spyOn(ChatBubbleUtilities, 'setFigureImage').mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const requests = Array.from({ length: 100 }, () => ChatBubbleUtilities.getUserImage('same'));
    expect(render).toHaveBeenCalledOnce();
    const high = ChatBubbleUtilities.getUserImage('same', true);
    expect(render).toHaveBeenCalledTimes(2);
    finish('head');
    expect(await Promise.all([...requests, high])).toEqual(Array(101).fill('head'));
});

it('allows retry after a head render fails', async () => {
    const render = vi.spyOn(ChatBubbleUtilities, 'setFigureImage').mockRejectedValueOnce(new Error('decode')).mockResolvedValue('retry');
    await expect(ChatBubbleUtilities.getUserImage('same')).rejects.toThrow('decode');
    await expect(ChatBubbleUtilities.getUserImage('same')).resolves.toBe('retry');
    expect(render).toHaveBeenCalledTimes(2);
});

it('waits for a loading figure and redraws the requested figure instead of caching the placeholder head', async () => {
    let listener: { resetFigure: (figure: string) => void };
    const placeholder = { isPlaceholder: () => true, dispose: vi.fn() };
    vi.mocked(GetAvatarRenderManager).mockReturnValue({
        createAvatarImage: (_figure: string, _size: string, _gender: string, imageListener: typeof listener) => { listener = imageListener; return placeholder; }
    } as unknown as ReturnType<typeof GetAvatarRenderManager>);
    const real = ChatBubbleUtilities.setFigureImage.bind(ChatBubbleUtilities);
    const render = vi.spyOn(ChatBubbleUtilities, 'setFigureImage').mockImplementationOnce(real).mockResolvedValueOnce('real-head');
    const head = ChatBubbleUtilities.setFigureImage('hr-100-61.hd-180-1', false, true);
    await Promise.resolve();
    // The renderer reports readiness with its normalised figure string.
    listener.resetFigure('hd-180-1.hr-100-61');
    await expect(head).resolves.toBe('real-head');
    expect(render).toHaveBeenLastCalledWith('hr-100-61.hd-180-1', false, true, false);
    expect(placeholder.dispose).toHaveBeenCalledOnce();
    expect(ChatBubbleUtilities.AVATAR_IMAGE_CACHE.size).toBe(0);
});
