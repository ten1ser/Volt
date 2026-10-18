import { describe, expect, it, vi } from 'vitest';
import { GetProductIconUrl } from './CatalogUtilities';
import { Product } from './Product';
import { ProductTypeEnum } from './ProductTypeEnum';

const native = vi.hoisted(() => ({ wall: vi.fn(), floor: vi.fn() }));
vi.mock('@volt/renderer', () => ({
    GetRoomEngine: () => ({ getFurnitureWallIconUrl: native.wall, getFurnitureFloorIconUrl: native.floor })
}));
vi.mock('../volt', () => ({ GetConfigurationValue: () => '/catalogue' }));

describe('catalog product icon resolution', () =>
{
    it('keeps native poster and sticky-note names instead of adding extra parameters to filenames', () =>
    {
        native.wall.mockReturnValueOnce('/icons/poster2_icon.png').mockReturnValueOnce('/icons/post_it_vd_icon.png');
        const poster = new Product(ProductTypeEnum.WALL, 4001, '2', 1, null, { className: 'poster' } as never);
        const stickies = new Product(ProductTypeEnum.WALL, 4220, '20', 1, null, { className: 'post.it.vd' } as never);
        expect(GetProductIconUrl(poster)).toBe('/icons/poster2_icon.png');
        expect(GetProductIconUrl(stickies)).toBe('/icons/post_it_vd_icon.png');
        expect(native.wall).toHaveBeenCalledWith(4001, '2');
        expect(native.wall).toHaveBeenCalledWith(4220, '20');
    });

    it('preserves floor colour zero and delegates material swatches to Product', () =>
    {
        native.floor.mockReturnValue('/icons/chair_0_icon.png');
        const chair = new Product(ProductTypeEnum.FLOOR, 8, '', 1, null, { className: 'chair', hasIndexedColor: true, colorIndex: 0 } as never);
        expect(GetProductIconUrl(chair)).toBe('/icons/chair_0_icon.png');
        const material = new Product(ProductTypeEnum.WALL, 9, '3.1', 1, null, { className: 'landscape' } as never);
        expect(GetProductIconUrl(material, { product: material } as never)).toBe('/catalogue/th_landscape_3_1_001.png');
    });
});
