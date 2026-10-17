import type { VoltSprite } from '@volt/renderer';

export const updateCityBackdrop = (background: Pick<VoltSprite, 'tint' | 'destroyed'>, color: number | null,
    originalColor: number, roomOverride: boolean): void =>
{
    if(!background || background.destroyed || roomOverride || originalColor !== 0) return;
    background.tint = color ?? originalColor;
};
