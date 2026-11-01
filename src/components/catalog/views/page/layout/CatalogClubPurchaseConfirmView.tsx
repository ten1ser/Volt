import { ClubOfferData } from '@volt/renderer';
import { CSSProperties, FC, useEffect, useMemo, useRef, useState } from 'react';
import { GetConfigurationValue, LocalizeText } from '../../../../../api';
import { LayoutCurrencyIcon, VoltCardContentView, VoltCardHeaderView, VoltCardView } from '../../../../../common';
import { useMeasuredFloorHeight } from '../../../../../hooks/catalog/useMeasuredFloorHeight';
import { CatalogClubPriceFieldView } from './CatalogClubPriceFieldView';

interface CatalogClubPurchaseConfirmViewProps {
    offer: ClubOfferData;
    productText: string;
    validUntilText: string;
    onCancel: () => void;
    onConfirm: () => void;
}

// club_buy_confirmation (1836) is 369x210; its frame margins put the content at 3,36, so the frame adds 49px around the content.
const REFERENCE_FRAME_HEIGHT = 210;
const FRAME_CHROME_HEIGHT = 49;
const ACTIONS_HEIGHT = 27;
const TITLE_DEFAULT_HEIGHT = 21;
const DISCLAIMER_DEFAULT_HEIGHT = 17;
const DISCLAIMER_MIN_HEIGHT = 17;

export const CatalogClubPurchaseConfirmView: FC<CatalogClubPurchaseConfirmViewProps> = (props) => {
    const { offer, productText, validUntilText, onCancel, onConfirm } = props;
    const disclaimerEnabled = useMemo(() => GetConfigurationValue<boolean>('disclaimer.credit_spending.enabled', false), []);
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(!disclaimerEnabled);
    const showCredits = offer.priceCredits > 0 || offer.priceActivityPoints <= 0;
    const titleTextRef = useRef<HTMLSpanElement>(null);
    const disclaimerTextRef = useRef<HTMLSpanElement>(null);
    const titleHeight = useMeasuredFloorHeight(titleTextRef, true, 0, TITLE_DEFAULT_HEIGHT);
    const disclaimerHeight = useMeasuredFloorHeight(disclaimerTextRef, disclaimerEnabled, DISCLAIMER_MIN_HEIGHT, DISCLAIMER_DEFAULT_HEIGHT);

    // Column: title (auto), 3, date (20), 3, cost row (22), inside a 10px top inset, minimum 60px.
    const productHeight = Math.max(60, 10 + titleHeight + 3 + 20 + 3 + 22);
    const disclaimerY = productHeight + 10;
    const actionsY = productHeight + 10 + (disclaimerEnabled ? disclaimerHeight + 10 : 0);
    const contentHeight = actionsY + ACTIONS_HEIGHT;
    const frameHeight = contentHeight + FRAME_CHROME_HEIGHT;
    // AIR centres the initial dialog once, then retains its origin when text resizes it.
    const [initialOffsetTop] = useState(() => (frameHeight - REFERENCE_FRAME_HEIGHT) / 2);
    const layoutVars = {
        '--volt-club-confirm-title-height': `${titleHeight}px`,
        '--volt-club-confirm-product-height': `${productHeight}px`,
        '--volt-club-confirm-disclaimer-y': `${disclaimerY}px`,
        '--volt-club-confirm-disclaimer-height': `${disclaimerHeight}px`,
        '--volt-club-confirm-actions-y': `${actionsY}px`,
        '--volt-club-confirm-content-height': `${contentHeight}px`,
        '--volt-club-confirm-frame-height': `${frameHeight}px`
    } as CSSProperties;

    useEffect(() => setDisclaimerAccepted(!disclaimerEnabled), [disclaimerEnabled, offer.offerId]);

    const title = LocalizeText('catalog.club.buy.confirm');

    return (
        <VoltCardView
            uniqueKey="catalog-club-confirm"
            aria-label={title}
            aria-modal="true"
            classNames={['volt-club-purchase-confirm']}
            dragStyle={{ height: frameHeight }}
            frameStyle={3}
            isResizable={false}
            offsetTop={initialOffsetTop}
            role="dialog"
            style={layoutVars}
            theme="primary-slim"
        >
            <VoltCardHeaderView headerText={title} onCloseClick={onCancel} />
            <VoltCardContentView classNames={['volt-club-purchase-confirm-content']} overflow="hidden">
                <div className="volt-club-purchase-confirm-product">
                    <span aria-hidden="true" className="volt-club-purchase-confirm-icon" />
                    <div className="volt-club-purchase-confirm-copy">
                        <strong className="volt-club-purchase-confirm-title">
                            <span ref={titleTextRef} className="volt-club-purchase-confirm-title-text">
                                {productText}
                            </span>
                        </strong>
                        <span>{validUntilText}</span>
                        <div className="volt-club-purchase-confirm-cost-row">
                            <CatalogClubPriceFieldView value={LocalizeText('catalog.purchase.confirmation.dialog.cost')} />
                            <span className="volt-club-purchase-confirm-price">
                                {showCredits && (
                                    <span className="volt-club-purchase-confirm-price-part" data-currency-type="-1">
                                        <CatalogClubPriceFieldView value={offer.priceCredits} />
                                        <LayoutCurrencyIcon type={-1} />
                                    </span>
                                )}
                                {offer.priceActivityPoints > 0 && (
                                    <span className="volt-club-purchase-confirm-price-part" data-currency-type={offer.priceActivityPointsType}>
                                        <CatalogClubPriceFieldView value={`${offer.priceCredits > 0 ? '+ ' : ''}${offer.priceActivityPoints}`} />
                                        <LayoutCurrencyIcon type={offer.priceActivityPointsType} />
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {disclaimerEnabled && (
                    <label className="volt-club-purchase-confirm-disclaimer">
                        <input checked={disclaimerAccepted} type="checkbox" onChange={(event) => setDisclaimerAccepted(event.target.checked)} />
                        <span ref={disclaimerTextRef}>{LocalizeText('disclaimer.credit_spending')}</span>
                    </label>
                )}

                <div className="volt-club-purchase-confirm-actions">
                    <button className="volt-club-purchase-confirm-cancel" type="button" onClick={onCancel}>
                        {LocalizeText('cancel')}
                    </button>
                    <button className="volt-club-purchase-confirm-submit" disabled={!disclaimerAccepted} type="button" onClick={onConfirm}>
                        {LocalizeText('catalog.club.buy.subscribe')}
                    </button>
                </div>
            </VoltCardContentView>
        </VoltCardView>
    );
};
