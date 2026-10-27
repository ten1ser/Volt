import { describe, expect, it, vi } from 'vitest';
import { furnitureDescription } from './furnitureDescription';

vi.mock('../../../../api', () => ({ localizeWithFallback: (_key: string, fallback: string) => fallback }));

describe('Inventory furni description', () =>
{
    it('keeps a real description', () =>
    {
        expect(furnitureDescription('A cold fridge for dairy.', 4)).toBe('A cold fridge for dairy.');
    });

    it('replaces a furnidata placeholder or missing description with the owned count', () =>
    {
        expect(furnitureDescription('market_c19_dairyfridge desc', 4)).toBe('Owned: 4');
        expect(furnitureDescription('', 1)).toBe('Owned: 1');
    });
});
