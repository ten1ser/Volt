import { localizeWithFallback } from '../../../../api';

// Furnidata without a real description carries a placeholder such as "market_c19_dairyfridge desc".
const PLACEHOLDER_DESCRIPTION = /^\S+ desc$/;

/** The description to show under a furni's name: its real description, or how many the player owns. */
export const furnitureDescription = (description: string, ownedCount: number): string =>
{
    if (description && !PLACEHOLDER_DESCRIPTION.test(description.trim())) return description;

    return localizeWithFallback('districtrp.inventory.owned', `Owned: ${ownedCount}`, ['count'], [String(ownedCount)]);
};
