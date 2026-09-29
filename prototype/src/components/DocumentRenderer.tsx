import React from 'react';
import { QuoteTemplateStyle, BusinessProfile, Discount, LineItemCustomizations, SelectedCustomization } from '../types';
import { STANDARD_QUOTE_TEMPLATES } from '../data/quoteTemplates';
import { getProductPhotoUrl, handleImageError } from '../lib/imageUtils';

export interface RenderItem {
  id: string;
  productName: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  total: number;
  selectedCustomizations?: LineItemCustomizations;
  productPhoto?: string;
  hideImage?: boolean;
}

export interface DocumentRendererProps {
  documentType: 'quote' | 'invoice' | 'credit_note';
  documentNumber: string;
  date: string;
  expiryOrDueDate: string;
  profile: BusinessProfile;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerIsBusiness?: boolean;
  customerContactPerson?: string;
  customerVatNumber?: string;
  customerCompanyRegNumber?: string;
  customerBillingAddress?: string;
  customerShippingAddress?: string;
  items: RenderItem[];
  subtotal?: number;
  discount?: Discount;
  hasDiscount?: boolean;
  vatAmount?: number;
  hasVat?: boolean;
  totalAmount: number;
  notes?: string;
  signOffMessage?: string;
  fulfillmentType?: 'collection' | 'delivery';
  fulfillmentAddress?: string;
  templateStyle: QuoteTemplateStyle;
  printableId?: string;
  // Credit Note specific fields
  creditInvoiceNumber?: string;
  creditInvoiceDate?: string;
  creditReason?: string;
}

export const DocumentRenderer: React.FC<DocumentRendererProps> = ({
  documentType,
  documentNumber,
  date,
  expiryOrDueDate,
  profile,
  customerName,
  customerEmail,
  customerPhone,
  customerAddress,
  customerIsBusiness,
  customerContactPerson,
  customerVatNumber,
  customerCompanyRegNumber,
  customerBillingAddress,
  customerShippingAddress,
  items,
  subtotal,
  discount,
  hasDiscount,
  vatAmount,
  hasVat,
  totalAmount,
  notes,
  signOffMessage,
  fulfillmentType,
  fulfillmentAddress,
  templateStyle,
  printableId,
  creditInvoiceNumber,
  creditInvoiceDate,
  creditReason
}) => {
  const safeStyle = templateStyle && templateStyle.headerFont ? templateStyle : STANDARD_QUOTE_TEMPLATES[0];
  const effectivePrintableId = printableId || (documentType === 'invoice' ? 'printable-invoice-area' : documentType === 'credit_note' ? 'printable-credit-note-area' : 'printable-quote-area');

  // Font family mappings
  const getFontFamily = (fontOption: string) => {
    switch (fontOption) {
      case 'serif':
        return "'Playfair Display', Georgia, 'Times New Roman', serif";
      case 'mono':
        return "'JetBrains Mono', SFMono-Regular, Consolas, monospace";
      case 'display':
        return "'Cinzel', 'Playfair Display', Georgia, serif";
      case 'playful':
        return "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif";
      case 'sans':
      default:
        return "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    }
  };

  const headerFontFamily = getFontFamily(safeStyle.headerFont);
  const bodyFontFamily = getFontFamily(safeStyle.bodyFont);

  // Outer Frame: Enforce 0px corner radius and no border
  const borderRadiusClass = 'rounded-none';
  const borderWidthClass = 'border-0';

  // Photo option settings
  const showPhotos = safeStyle.showProductPhotos !== false;
  const photoCornerRadius = safeStyle.productPhotoRadius || 'rounded';
  const photoCornerClass = photoCornerRadius === 'square'
    ? 'rounded-none'
    : photoCornerRadius === 'circle'
    ? 'rounded-full'
    : 'rounded-xl';

  // Logo & Branding Display settings
  const logoMode = safeStyle.logoDisplayMode || 'logo-and-name';
  const showLogoImage = logoMode === 'logo-and-name' || logoMode === 'logo-only';
  const showCompanyName = logoMode === 'logo-and-name' || logoMode === 'name-only';

  // Dynamic inline style objects for total theme application
  const containerStyle: React.CSSProperties = {
    backgroundColor: safeStyle.bgColor,
    color: safeStyle.textColor,
    borderColor: safeStyle.borderColor || '#E5E7EB',
    fontFamily: bodyFontFamily,
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: headerFontFamily,
    color: safeStyle.headingColor,
  };

  const accentTextStyle: React.CSSProperties = {
    color: safeStyle.accentColor,
  };

  const isQuote = documentType === 'quote';
  const isCreditNote = documentType === 'credit_note';
  const documentTitle = isQuote 
    ? 'Quotation' 
    : isCreditNote 
      ? (profile.isVatRegistered ? 'Tax Credit Note' : 'Credit Note')
      : (profile.isVatRegistered ? 'Tax Invoice' : 'Invoice');

  return (
    <div
      id={effectivePrintableId}
      className={`relative ${borderRadiusClass} ${borderWidthClass} shadow-sm transition-all duration-200 overflow-hidden print:p-0 print:border-none print:shadow-none`}
      style={containerStyle}
    >
      {/* 1. Header Banner Styles (spans 100% width cleanly) */}
      {safeStyle.bannerStyle === 'full-banner' && (
        <div 
          className="h-3 w-full" 
          style={{ backgroundColor: safeStyle.accentColor }} 
        />
      )}

      {safeStyle.bannerStyle === 'top-bar' && (
        <div 
          className="h-1.5 w-full" 
          style={{ backgroundColor: safeStyle.accentColor }} 
        />
      )}

      {safeStyle.bannerStyle === 'curved-header' && (
        <div 
          className="p-8 sm:p-10 pb-12 text-white flex justify-between items-center"
          style={{ 
            backgroundColor: safeStyle.accentColor, 
            borderBottomLeftRadius: '50% 28px', 
            borderBottomRightRadius: '50% 28px' 
          }}
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-wider" style={{ fontFamily: headerFontFamily }}>
              {profile.name}
            </h1>
            <p className="text-xs opacity-90 mt-1">{profile.tagline || 'Artisan Quote & Order'}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
            {isQuote ? 'Quotation' : isCreditNote ? 'Credit Note' : 'Invoice'}
          </div>
        </div>
      )}

      {safeStyle.bannerStyle === 'botanical-accent' && (
        <div className="relative p-6 sm:p-8 bg-amber-50/40 border-b border-amber-100/60 overflow-hidden flex items-center justify-between">
          <svg className="absolute -right-4 -bottom-6 w-32 h-32 opacity-15 text-rose-800 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <div className="space-y-0.5 relative z-10">
            <span className="text-xs uppercase font-semibold tracking-wider text-amber-800/70">Artisan Specification</span>
            <h2 className="text-xl sm:text-2xl font-bold text-amber-950" style={headingStyle}>{profile.name}</h2>
          </div>
          <div className="text-right relative z-10">
            <span className="text-xs font-semibold text-amber-900 block" style={headingStyle}>{documentTitle}</span>
            <span className="text-xs font-bold text-amber-800 tabular-nums">{documentNumber}</span>
          </div>
        </div>
      )}

      {safeStyle.bannerStyle === 'brutalist-block' && (
        <div 
          className="border-b-4 border-black p-6 sm:p-8 text-black flex justify-between items-center"
          style={{ backgroundColor: safeStyle.accentBgColor }}
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight" style={{ fontFamily: headerFontFamily }}>
              {isQuote ? 'QUOTE' : isCreditNote ? 'CREDIT NOTE' : 'INVOICE'}
            </h1>
            <span className="text-xs font-bold tracking-wider block mt-1 tabular-nums">{documentNumber}</span>
          </div>
          <div className="text-right font-bold text-xs uppercase border-2 border-black bg-white px-3.5 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {profile.name}
          </div>
        </div>
      )}

      {/* 2. Document Content Canvas with Generous, Aesthetic Margins */}
      <div className="p-8 sm:p-12 md:p-14 lg:p-16 print:p-0 space-y-8">
        {/* Top Header Info (Business Profile & Document Number) */}
        <div className="flex justify-between items-start gap-8 pb-6 sm:pb-8 border-b border-stone-200/60">
          <div className="space-y-3 max-w-sm sm:max-w-md">
            {showLogoImage && (
              profile.logo ? (
                <img src={profile.logo} alt="Logo" className="w-16 h-16 object-cover rounded-xl shadow-2xs" referrerPolicy="no-referrer" />
              ) : (
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shadow-2xs"
                  style={{ backgroundColor: safeStyle.accentBgColor, color: safeStyle.accentColor }}
                >
                  {profile.name ? profile.name.charAt(0).toUpperCase() : 'M'}
                </div>
              )
            )}
            <div className="space-y-1">
              {showCompanyName && (
                <h4 className="font-bold text-xl sm:text-2xl tracking-tight" style={headingStyle}>{profile.name}</h4>
              )}
              {profile.tagline && (
                <p className="text-xs opacity-70 italic">{profile.tagline}</p>
              )}
              {profile.address && <p className="text-xs opacity-80 leading-relaxed pt-0.5">{profile.address}</p>}
              <p className="text-xs opacity-80">
                {[profile.phone && `Cell: ${profile.phone}`, profile.email && `Email: ${profile.email}`].filter(Boolean).join(' | ')}
              </p>
              {profile.vatNumber && profile.isVatRegistered && (
                <p className="text-xs font-semibold pt-0.5">VAT Reg No: <span className="tabular-nums">{profile.vatNumber}</span></p>
              )}
            </div>
          </div>

          <div className="text-right space-y-1.5 shrink-0">
            <h3 className="text-2xl sm:text-3xl font-bold uppercase tracking-wider" style={headingStyle}>
              {documentTitle}
            </h3>
            <span className="text-sm font-bold block tabular-nums" style={accentTextStyle}>
              {documentNumber}
            </span>
            <div className="text-xs opacity-80 space-y-1 pt-2">
              <div><span className="opacity-70">Date:</span> <strong className="tabular-nums font-semibold">{date}</strong></div>
              {!isCreditNote && <div><span className="opacity-70">{isQuote ? 'Expires:' : 'Due Date:'}</span> <strong className="tabular-nums font-semibold">{expiryOrDueDate}</strong></div>}
            </div>
          </div>
        </div>

        {/* Credit Note SARS Section 21 Reference Banner */}
        {isCreditNote && creditInvoiceNumber && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-900">Original Tax Invoice:</span>
              <span className="font-bold bg-amber-100/80 px-2 py-0.5 rounded text-amber-950 border border-amber-200 tabular-nums">
                {creditInvoiceNumber}
              </span>
              {creditInvoiceDate && (
                <span className="text-amber-800 text-xs">dated {creditInvoiceDate}</span>
              )}
            </div>
            {creditReason && (
              <div className="text-xs">
                <span className="text-amber-800/80 font-medium">Reason for Credit: </span>
                <span className="font-bold text-amber-950">{creditReason}</span>
              </div>
            )}
          </div>
        )}

        {/* 3. Customer Info Section */}
        <div className="space-y-3 pb-6 sm:pb-8 border-b border-stone-200/60">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-70 block">
            {isQuote ? 'Quote Prepared For' : isCreditNote ? 'Credit Issued To' : 'Invoice Billed To'}
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <h5 className="font-bold text-base sm:text-lg text-stone-900">{customerName}</h5>
            {customerIsBusiness && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-stone-200/70 text-stone-700">
                Business
              </span>
            )}
          </div>

          {customerIsBusiness && customerContactPerson && (
            <div className="text-xs font-medium text-stone-700">
              <span className="opacity-70">Attn / Contact:</span> {customerContactPerson}
            </div>
          )}

          {(customerCompanyRegNumber || customerVatNumber) && (
            <div className="text-xs opacity-85 flex flex-wrap gap-x-4 gap-y-1">
              {customerCompanyRegNumber && (
                <span><strong className="opacity-70">Reg No:</strong> <span className="tabular-nums font-medium">{customerCompanyRegNumber}</span></span>
              )}
              {customerVatNumber && (
                <span><strong className="opacity-70">VAT No:</strong> <span className="tabular-nums font-medium">{customerVatNumber}</span></span>
              )}
            </div>
          )}

          <div className="text-xs opacity-80 space-y-1.5">
            {customerBillingAddress && customerShippingAddress && customerBillingAddress !== customerShippingAddress ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-xs">
                <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wider block opacity-70 mb-1">Billing Address</span>
                  <div className="leading-relaxed whitespace-pre-line text-stone-700">{customerBillingAddress}</div>
                </div>
                <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wider block opacity-70 mb-1">Shipping Address</span>
                  <div className="leading-relaxed whitespace-pre-line text-stone-700">{customerShippingAddress}</div>
                </div>
              </div>
            ) : (
              (customerBillingAddress || customerAddress || customerShippingAddress) && (
                <div className="leading-relaxed whitespace-pre-line pt-0.5">{customerBillingAddress || customerAddress || customerShippingAddress}</div>
              )
            )}

            {(customerEmail || customerPhone) && (
              <div className="pt-0.5">{[customerEmail, customerPhone].filter(Boolean).join(' | ')}</div>
            )}
          </div>

          {fulfillmentType === 'delivery' && fulfillmentAddress && (!customerShippingAddress || fulfillmentAddress !== customerShippingAddress) && (
            <div className="p-3 rounded-xl border border-stone-200/60 text-xs max-w-md bg-stone-50/60">
              <span className="text-[10px] font-semibold opacity-70 uppercase tracking-wider block mb-1">Delivery Location</span>
              <span className="font-semibold text-stone-800">{fulfillmentAddress}</span>
            </div>
          )}
        </div>

        {/* 4. Items Table */}
        <div>
          {safeStyle.tableHeaderStyle === 'rounded-pill' ? (
            <div className="space-y-3">
              <div 
                className="grid grid-cols-12 gap-2 p-3.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wider"
                style={{ backgroundColor: safeStyle.accentBgColor, color: safeStyle.accentTextColor || safeStyle.textColor }}
              >
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right">Rate</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              <div className="divide-y divide-stone-200/50">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 py-4 px-3 text-xs items-start">
                    <div className="col-span-6 flex gap-3.5 items-start">
                      {showPhotos && item.productPhoto && !item.hideImage && (
                        <img
                          src={getProductPhotoUrl(item.productPhoto, item.productName)}
                          alt={item.productName}
                          className={`w-14 h-14 sm:w-16 sm:h-16 object-cover ${photoCornerClass} border border-stone-200/80 shrink-0 mt-0.5 shadow-2xs print:w-12 print:h-12`}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, item.productName)}
                        />
                      )}
                      <div className="space-y-1 min-w-0 flex-1">
                        <span className="font-semibold text-sm block text-stone-900">{item.productName}</span>
                        {item.productDescription && <span className="text-xs opacity-75 block leading-relaxed">{item.productDescription}</span>}
                        {item.selectedCustomizations && Object.entries(item.selectedCustomizations).length > 0 && (
                          <div className="text-[11px] space-y-0.5 mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(item.selectedCustomizations).map(([optName, selectVal]) => (
                              <span key={optName} className="inline-block bg-stone-100/80 border border-stone-200/80 px-2 py-0.5 rounded text-stone-700">
                                <span className="font-medium text-stone-500">{optName}:</span> <strong>{(selectVal as SelectedCustomization).value}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 text-center font-medium text-stone-700 text-sm tabular-nums">{item.quantity}</div>
                    <div className="col-span-2 text-right opacity-80 text-sm tabular-nums">R{item.unitPrice.toFixed(2)}</div>
                    <div className="col-span-2 text-right font-semibold text-stone-900 text-sm tabular-nums">R{item.total.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : safeStyle.tableRowStyle === 'card-rows' ? (
            <div className="space-y-3">
              <div 
                className="grid grid-cols-12 gap-2 p-3.5 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider"
                style={{ 
                  backgroundColor: safeStyle.tableHeaderStyle === 'espresso-block' ? '#3A2012' : safeStyle.accentBgColor, 
                  color: safeStyle.tableHeaderStyle === 'espresso-block' ? '#FFFFFF' : safeStyle.textColor 
                }}
              >
                <div className="col-span-6">Items</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right">Unit Rate</div>
                <div className="col-span-2 text-right">Line Total</div>
              </div>
              <div className="space-y-2.5">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 p-4 bg-white rounded-xl border border-stone-200/70 text-xs items-start shadow-2xs">
                    <div className="col-span-6 flex gap-3.5 items-start">
                      {showPhotos && item.productPhoto && !item.hideImage && (
                        <img
                          src={getProductPhotoUrl(item.productPhoto, item.productName)}
                          alt={item.productName}
                          className={`w-14 h-14 sm:w-16 sm:h-16 object-cover ${photoCornerClass} border border-stone-200/80 shrink-0 mt-0.5 shadow-2xs print:w-12 print:h-12`}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, item.productName)}
                        />
                      )}
                      <div className="space-y-1 min-w-0 flex-1">
                        <span className="font-semibold text-sm text-stone-900 block">{item.productName}</span>
                        {item.productDescription && <span className="text-xs opacity-75 block leading-relaxed">{item.productDescription}</span>}
                        {item.selectedCustomizations && Object.entries(item.selectedCustomizations).length > 0 && (
                          <div className="text-[11px] space-y-0.5 mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(item.selectedCustomizations).map(([optName, selectVal]) => (
                              <span key={optName} className="inline-block bg-stone-50 border border-stone-200 px-2 py-0.5 rounded text-stone-700">
                                <span className="font-medium text-stone-500">{optName}:</span> <strong>{(selectVal as SelectedCustomization).value}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 text-center font-medium text-stone-700 text-sm tabular-nums">{item.quantity}</div>
                    <div className="col-span-2 text-right text-stone-600 text-sm tabular-nums">R{item.unitPrice.toFixed(2)}</div>
                    <div className="col-span-2 text-right font-semibold text-stone-900 text-sm tabular-nums">R{item.total.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <table className={`w-full text-left text-xs border-collapse ${safeStyle.tableRowStyle === 'full-grid' ? 'border-2 border-black' : ''}`}>
              <thead>
                <tr 
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    safeStyle.tableHeaderStyle === 'filled-row'
                      ? 'border-b border-stone-200'
                      : safeStyle.tableHeaderStyle === 'bold-solid'
                      ? 'border-b-2 border-black bg-black text-white'
                      : 'border-b border-stone-200/80 opacity-80'
                  }`}
                  style={
                    safeStyle.tableHeaderStyle === 'filled-row'
                      ? { backgroundColor: safeStyle.accentBgColor, color: safeStyle.accentTextColor }
                      : undefined
                  }
                >
                  <th className="py-3 px-3">Item Description</th>
                  <th className="py-3 px-3 text-center">Qty</th>
                  <th className="py-3 px-3 text-right">Unit Price</th>
                  <th className="py-3 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${safeStyle.tableRowStyle === 'full-grid' ? 'divide-black border-black' : 'divide-stone-200/50'}`}>
                {items.map((item, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="py-4 px-3">
                      <div className="flex gap-3.5 items-start">
                        {showPhotos && item.productPhoto && !item.hideImage && (
                          <img
                            src={getProductPhotoUrl(item.productPhoto, item.productName)}
                            alt={item.productName}
                            className={`w-14 h-14 sm:w-16 sm:h-16 object-cover ${photoCornerClass} border border-stone-200/80 shrink-0 mt-0.5 shadow-2xs print:w-12 print:h-12`}
                            referrerPolicy="no-referrer"
                            onError={(e) => handleImageError(e, item.productName)}
                          />
                        )}
                        <div className="space-y-1 min-w-0 flex-1">
                          <span className="font-semibold text-sm block text-stone-900">{item.productName}</span>
                          {item.productDescription && <span className="text-xs opacity-75 block leading-relaxed">{item.productDescription}</span>}
                          {item.selectedCustomizations && Object.entries(item.selectedCustomizations).length > 0 && (
                            <div className="text-[11px] space-y-0.5 mt-1.5 flex flex-wrap gap-1.5">
                              {Object.entries(item.selectedCustomizations).map(([optName, selectVal]) => (
                                <span key={optName} className="inline-block bg-stone-100/80 border border-stone-200/80 px-2 py-0.5 rounded text-stone-700">
                                  <span className="font-medium text-stone-500">{optName}:</span> <strong>{(selectVal as SelectedCustomization).value}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-center font-medium text-stone-700 text-sm tabular-nums">{item.quantity}</td>
                    <td className="py-4 px-3 text-right opacity-80 text-sm tabular-nums">R{item.unitPrice.toFixed(2)}</td>
                    <td className="py-4 px-3 text-right font-semibold text-stone-900 text-sm tabular-nums">R{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 5. Subtotal, Discounts, VAT & Grand Total */}
        <div className="flex flex-col items-end pt-2">
          <div className="w-full sm:w-80 space-y-2.5 text-xs sm:text-sm">
            {subtotal !== undefined && (
              <div className="flex justify-between items-center opacity-80">
                <span>Subtotal:</span>
                <span className="font-medium text-stone-800 tabular-nums">R{subtotal.toFixed(2)}</span>
              </div>
            )}

            {hasDiscount && discount && (
              <div className="flex justify-between items-center text-emerald-700 font-medium">
                <span>Discount ({discount.type === 'percentage' ? `${discount.value}%` : `R${discount.value}`}):</span>
                <span className="tabular-nums">
                  -R
                  {discount.type === 'percentage'
                    ? (((subtotal || totalAmount) * discount.value) / 100).toFixed(2)
                    : discount.value.toFixed(2)}
                </span>
              </div>
            )}

            {hasVat && vatAmount !== undefined && (
              <div className="flex justify-between items-center opacity-80">
                <span>SARS VAT (15%):</span>
                <span className="font-medium text-stone-800 tabular-nums">R{vatAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Grand Total Rendering */}
            {safeStyle.totalBoxStyle === 'standalone-pill' ? (
              <div 
                className="mt-4 p-3.5 px-6 rounded-full flex justify-between items-center font-bold text-xs sm:text-sm shadow-2xs"
                style={{ backgroundColor: safeStyle.accentBgColor, color: safeStyle.accentTextColor || safeStyle.headingColor }}
              >
                <span className="uppercase tracking-wider text-xs font-semibold">
                  {isCreditNote ? 'Total Credit' : 'Total Due'}
                </span>
                <span className="text-base sm:text-lg font-bold tabular-nums">R{totalAmount.toFixed(2)}</span>
              </div>
            ) : safeStyle.totalBoxStyle === 'brutalist-banner' ? (
              <div className="mt-4 p-3.5 px-5 bg-black text-white border-2 border-black flex justify-between items-center font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_rgba(250,204,21,1)]">
                <span className="uppercase tracking-wider text-xs font-bold">
                  {isCreditNote ? 'TOTAL CREDIT VALUE' : 'TOTAL DUE'}
                </span>
                <span className="text-base sm:text-lg font-black text-amber-300 tabular-nums">R{totalAmount.toFixed(2)}</span>
              </div>
            ) : safeStyle.totalBoxStyle === 'filled-card' ? (
              <div 
                className="mt-4 p-3.5 px-5 rounded-xl border flex justify-between items-center font-bold text-xs sm:text-sm"
                style={{ 
                  backgroundColor: safeStyle.accentBgColor, 
                  borderColor: safeStyle.accentColor,
                  color: safeStyle.accentTextColor || safeStyle.headingColor 
                }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {isCreditNote ? 'Total Credit Amount:' : 'Total Amount:'}
                </span>
                <span className="text-base sm:text-lg font-bold tabular-nums">R{totalAmount.toFixed(2)}</span>
              </div>
            ) : (
              <div className="pt-3 border-t border-stone-200/80 flex justify-between items-center text-xs sm:text-sm">
                <span className="font-semibold uppercase tracking-wider text-xs opacity-80">
                  {isCreditNote ? 'Total Credit Value:' : 'Total Amount:'}
                </span>
                <span className="text-base sm:text-lg font-bold tabular-nums" style={accentTextStyle}>R{totalAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 6. Notes & Terms */}
        {notes && (
          <div className="pt-6 border-t border-stone-200/60 text-xs space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70 block">Notes / Terms of Trade</span>
            <p className="whitespace-pre-line leading-relaxed opacity-85 text-stone-700">{notes}</p>
          </div>
        )}

        {/* 7. Banking Details */}
        {profile.bankingDetails && (profile.bankingDetails.bankName || profile.bankingDetails.accountNumber) && (
          <div className="pt-6 border-t border-stone-200/60 text-xs">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70 block mb-2.5">
              Banking & Payment Details
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50/80 rounded-2xl p-4 border border-stone-200/70 text-xs">
              {profile.bankingDetails.bankName && (
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold tracking-wider">Bank</span>
                  <span className="font-semibold text-stone-800 text-xs sm:text-sm">{profile.bankingDetails.bankName}</span>
                </div>
              )}
              {profile.bankingDetails.accountNumber && (
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold tracking-wider">Account Number</span>
                  <span className="font-semibold text-stone-800 text-xs sm:text-sm tabular-nums">{profile.bankingDetails.accountNumber}</span>
                </div>
              )}
              {profile.bankingDetails.branchCode && (
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold tracking-wider">Branch Code</span>
                  <span className="font-semibold text-stone-800 text-xs sm:text-sm tabular-nums">{profile.bankingDetails.branchCode}</span>
                </div>
              )}
              {profile.bankingDetails.accountType && (
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold tracking-wider">Account Type</span>
                  <span className="font-semibold text-stone-800 text-xs sm:text-sm">{profile.bankingDetails.accountType}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. Signoff Message */}
        {signOffMessage && (
          <div className="pt-2 text-center text-xs italic opacity-75">
            "{signOffMessage}"
          </div>
        )}
      </div>

      {/* Optional Accent Footer Bar */}
      {safeStyle.bannerStyle === 'botanical-accent' && (
        <div 
          className="h-2.5 w-full" 
          style={{ backgroundColor: safeStyle.accentColor }} 
        />
      )}
    </div>
  );
};
