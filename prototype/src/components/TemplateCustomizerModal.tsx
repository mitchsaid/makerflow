import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, RefreshCw, Save, Paintbrush, Type, Layout, Table, Palette, Trash2 } from 'lucide-react';
import { QuoteTemplateStyle, BusinessProfile, TemplateFontOption, TemplateBannerStyle, TableHeaderStyle, TableRowStyle, TotalBoxStyle, TemplateBorderRadius } from '../types';
import { STANDARD_QUOTE_TEMPLATES } from '../data/quoteTemplates';
import { DocumentRenderer, RenderItem } from './DocumentRenderer';
import { getProductPhotoUrl } from '../lib/imageUtils';

interface TemplateCustomizerModalProps {
  isOpen?: boolean;
  onClose: () => void;
  initialTemplateStyle?: QuoteTemplateStyle;
  currentStyle?: QuoteTemplateStyle;
  profile?: BusinessProfile;
  customTemplates: QuoteTemplateStyle[];
  onApplyStyle: (style: QuoteTemplateStyle) => void;
  onSaveCustomTemplate?: (style: QuoteTemplateStyle) => void;
  onSaveAsCustomTemplate?: (style: QuoteTemplateStyle) => void;
  onDeleteCustomTemplate?: (templateId: string) => void;
}

export const TemplateCustomizerModal: React.FC<TemplateCustomizerModalProps> = ({
  isOpen = true,
  onClose,
  initialTemplateStyle,
  currentStyle,
  profile,
  customTemplates,
  onApplyStyle,
  onSaveCustomTemplate,
  onSaveAsCustomTemplate,
  onDeleteCustomTemplate,
}) => {
  const baseStyle = initialTemplateStyle || currentStyle || STANDARD_QUOTE_TEMPLATES[0];
  const [workingStyle, setWorkingStyle] = useState<QuoteTemplateStyle>({ ...baseStyle });
  const [activeTab, setActiveTab] = useState<'presets' | 'fonts' | 'colors' | 'layout' | 'table'>('presets');
  const [templateName, setTemplateName] = useState(baseStyle.name ? (baseStyle.isCustom ? baseStyle.name : `Remix: ${baseStyle.name}`) : 'My Custom Theme');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [themeToDelete, setThemeToDelete] = useState<QuoteTemplateStyle | null>(null);

  useEffect(() => {
    if (isOpen && baseStyle) {
      setWorkingStyle({ ...baseStyle });
      setTemplateName(
        baseStyle.isCustom
          ? baseStyle.name
          : `Remix: ${baseStyle.name}`
      );
    }
  }, [isOpen, initialTemplateStyle, currentStyle]);

  if (!isOpen) return null;

  // Sample data for realistic preview
  const sampleItems: RenderItem[] = [
    {
      id: '1',
      productName: 'Vegetable-Tanned Leather Satchel',
      productDescription: 'Hand-stitched brass fittings with organic beeswax coating',
      productPhoto: getProductPhotoUrl('https://images.unsplash.com/photo-1548036328-c9fa89d128fa', 'satchel'),
      quantity: 1,
      unitPrice: 1850.00,
      total: 1850.00,
      selectedCustomizations: {
        'Leather Color': { value: 'Chestnut Brown', priceUplift: 0 },
        'Monogram': { value: 'M.D. Engraved', priceUplift: 150 }
      }
    },
    {
      id: '2',
      productName: 'Organic Fynbos & Honey Cold-Process Soap (100g)',
      productDescription: 'Triple-milled artisanal bar soap with local Cape Rooibos',
      productPhoto: getProductPhotoUrl('https://images.unsplash.com/photo-1607006482172-23f46f906f36', 'soap'),
      quantity: 5,
      unitPrice: 75.00,
      total: 375.00
    }
  ];

  const handleSelectPreset = (preset: QuoteTemplateStyle) => {
    setWorkingStyle({
      ...preset,
      id: workingStyle.isCustom ? workingStyle.id : preset.id,
      name: workingStyle.isCustom ? templateName : preset.name
    });
  };

  const handleApply = () => {
    onApplyStyle(workingStyle);
    onClose();
  };

  const handleSaveAsCustom = () => {
    const customStyle: QuoteTemplateStyle = {
      ...workingStyle,
      id: `custom-${Date.now()}`,
      name: templateName || 'Custom Remix Template',
      description: 'Custom remix theme saved by artisan',
      category: 'Custom',
      isCustom: true,
    };
    const saveFn = onSaveCustomTemplate || onSaveAsCustomTemplate;
    if (saveFn) {
      saveFn(customStyle);
    }
    onApplyStyle(customStyle);
    setSaveSuccessMsg('Template saved to your custom themes!');
    setTimeout(() => {
      setSaveSuccessMsg('');
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-stone-50 w-full max-w-6xl rounded-3xl border border-stone-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="bg-white px-6 py-4 border-b border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Paintbrush size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                Quote & Document Template Customiser
                <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {baseStyle.isCustom ? 'Template Editor' : 'Remix Engine'}
                </span>
              </h2>
              <p className="text-xs text-stone-500 font-medium">Customize fonts, canvas backgrounds, colors, banner headers, and table styling</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAsCustom}
              className="bg-stone-900 hover:bg-black text-white px-3.5 py-2 rounded-xl font-extrabold text-xs transition shadow-3xs flex items-center gap-1.5 cursor-pointer"
              title="Save as a reusable custom template"
            >
              <Save size={14} />
              <span>Save Theme</span>
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-extrabold text-xs transition shadow-3xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={15} />
              <span>Apply to Document</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Main Body: 2 Column Layout */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Column: Customization Controls (5 cols) */}
          <div className="lg:col-span-5 bg-white border-r border-stone-200/80 flex flex-col overflow-y-auto">
            {/* Category Sub-tabs */}
            <div className="flex border-b border-stone-100 p-2 gap-1 overflow-x-auto bg-stone-50/70 shrink-0">
              {[
                { id: 'presets', label: 'Presets', icon: Sparkles },
                { id: 'fonts', label: 'Fonts', icon: Type },
                { id: 'colors', label: 'Colors', icon: Palette },
                { id: 'layout', label: 'Layout', icon: Layout },
                { id: 'table', label: 'Table', icon: Table },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-3xs'
                        : 'text-stone-600 hover:bg-stone-200/60'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Controls Tab Body */}
            <div className="p-5 space-y-6 flex-1 overflow-y-auto">
              {/* TAB 1: PRESETS & REMIX BASE */}
              {activeTab === 'presets' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-stone-700 uppercase tracking-wider mb-1">
                      Choose Standard Template Base
                    </label>
                    <p className="text-[11px] text-stone-500 mb-3">Select a pre-designed layout as your starting point, then remix any property.</p>
                    
                    <div className="grid grid-cols-1 gap-2.5">
                      {[...STANDARD_QUOTE_TEMPLATES, ...customTemplates].map(preset => {
                        const isSelected = workingStyle.id === preset.id;
                        return (
                          <div
                            key={preset.id}
                            onClick={() => handleSelectPreset(preset)}
                            className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20 shadow-2xs'
                                : 'border-stone-200/80 bg-white hover:border-amber-300 hover:bg-stone-50/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-8 h-8 rounded-xl border flex items-center justify-center font-black text-xs shrink-0"
                                style={{ backgroundColor: preset.bgColor, borderColor: preset.borderColor, color: preset.textColor }}
                              >
                                Aa
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-xs text-stone-900">{preset.name}</span>
                                  {preset.isCustom && (
                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded uppercase">
                                      Custom
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-stone-500 block leading-tight">{preset.description}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs shrink-0">
                                  ✓
                                </div>
                              )}
                              {preset.isCustom && onDeleteCustomTemplate && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setThemeToDelete(preset);
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                                  title="Delete this custom theme"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save Custom Name Field */}
                  <div className="pt-4 border-t border-stone-200 space-y-2">
                    <label className="block text-xs font-extrabold text-stone-700 uppercase tracking-wider">
                      Save as Custom Template
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        placeholder="e.g. My Luxury Theme"
                        className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <button
                        onClick={handleSaveAsCustom}
                        className="bg-stone-900 hover:bg-black text-white px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition"
                      >
                        <Save size={14} />
                        <span>Save</span>
                      </button>
                    </div>
                    {saveSuccessMsg && (
                      <p className="text-xs text-emerald-700 font-bold animate-fadeIn">{saveSuccessMsg}</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: FONTS */}
              {activeTab === 'fonts' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-2">
                      Header / Title Font Family
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'serif', label: 'Playfair Serif', sample: 'Aa' },
                        { id: 'sans', label: 'Plus Jakarta Sans', sample: 'Aa' },
                        { id: 'display', label: 'Cinzel Editorial', sample: 'Aa' },
                        { id: 'playful', label: 'Outfit Playful', sample: 'Aa' },
                        { id: 'mono', label: 'JetBrains Mono', sample: 'Aa' },
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setWorkingStyle(prev => ({ ...prev, headerFont: f.id as TemplateFontOption }))}
                          className={`p-3 rounded-xl border text-left text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                            workingStyle.headerFont === f.id
                              ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20'
                              : 'border-stone-200 bg-stone-50/60 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <span>{f.label}</span>
                          <span className="text-xs font-black opacity-60">{f.sample}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-2">
                      Body & Details Font Family
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'sans', label: 'Plus Jakarta Sans' },
                        { id: 'serif', label: 'Playfair Serif' },
                        { id: 'mono', label: 'JetBrains Mono' },
                        { id: 'playful', label: 'Outfit Sans' },
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setWorkingStyle(prev => ({ ...prev, bodyFont: f.id as TemplateFontOption }))}
                          className={`p-3 rounded-xl border text-left text-xs font-semibold transition cursor-pointer ${
                            workingStyle.bodyFont === f.id
                              ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20'
                              : 'border-stone-200 bg-stone-50/60 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: COLORS */}
              {activeTab === 'colors' && (
                <div className="space-y-4">
                  {/* Canvas Background Color */}
                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-1.5">
                      Paper Canvas Background Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={workingStyle.bgColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, bgColor: e.target.value }))}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-stone-200 p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={workingStyle.bgColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, bgColor: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono uppercase"
                      />
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {['#FFFFFF', '#FAF7F2', '#FDF2F4', '#EFECE6', '#FFF5F7', '#FAFAFA'].map(hex => (
                        <button
                          key={hex}
                          onClick={() => setWorkingStyle(prev => ({ ...prev, bgColor: hex }))}
                          className="w-7 h-7 rounded-lg border border-stone-300 cursor-pointer shadow-3xs"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Primary Text Color */}
                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-1.5">
                      Primary Text Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={workingStyle.textColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, textColor: e.target.value }))}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-stone-200 p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={workingStyle.textColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, textColor: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono uppercase"
                      />
                    </div>
                  </div>

                  {/* Headings Color */}
                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-1.5">
                      Headings & Document Title Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={workingStyle.headingColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, headingColor: e.target.value }))}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-stone-200 p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={workingStyle.headingColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, headingColor: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono uppercase"
                      />
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-1.5">
                      Brand Accent Highlight Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={workingStyle.accentColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-stone-200 p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={workingStyle.accentColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono uppercase"
                      />
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {['#D97706', '#E07A5F', '#1E3A8A', '#FACC15', '#EC4899', '#3A2012', '#059669'].map(hex => (
                        <button
                          key={hex}
                          onClick={() => setWorkingStyle(prev => ({ ...prev, accentColor: hex }))}
                          className="w-7 h-7 rounded-lg border border-stone-300 cursor-pointer shadow-3xs"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Soft Accent Background Fill */}
                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-1.5">
                      Badge / Pill Fill Background
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={workingStyle.accentBgColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, accentBgColor: e.target.value }))}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-stone-200 p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={workingStyle.accentBgColor}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, accentBgColor: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: LAYOUT & BANNERS */}
              {activeTab === 'layout' && (
                <div className="space-y-5">
                  {/* Top Header Banner Style */}
                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-2">
                      Top Header Banner Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'none', label: 'Clean (No Banner)' },
                        { id: 'top-bar', label: 'Top Line Accent Bar' },
                        { id: 'full-banner', label: 'Full Solid Top Banner' },
                        { id: 'curved-header', label: 'Soft Curved Header' },
                        { id: 'botanical-accent', label: 'Botanical Illustration' },
                        { id: 'brutalist-block', label: 'Brutalist Block Banner' },
                      ].map(b => (
                        <button
                          key={b.id}
                          onClick={() => setWorkingStyle(prev => ({ ...prev, bannerStyle: b.id as TemplateBannerStyle }))}
                          className={`p-3 rounded-xl border text-left text-xs font-semibold transition cursor-pointer ${
                            workingStyle.bannerStyle === b.id
                              ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20'
                              : 'border-stone-200 bg-stone-50/60 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Header Logo & Company Name Display Options */}
                  <div className="pt-3 border-t border-stone-200">
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-2">
                      Header Logo & Branding
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'logo-and-name', label: 'Logo + Name', desc: 'Show both logo image and text' },
                        { id: 'logo-only', label: 'Just Logo', desc: 'Show logo image only' },
                        { id: 'name-only', label: 'Just Name', desc: 'Show text name only' },
                      ].map(lm => (
                        <button
                          key={lm.id}
                          type="button"
                          onClick={() => setWorkingStyle(prev => ({ ...prev, logoDisplayMode: lm.id as any }))}
                          className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            (workingStyle.logoDisplayMode || 'logo-and-name') === lm.id
                              ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20'
                              : 'border-stone-200 bg-stone-50/60 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <span className="block font-bold">{lm.label}</span>
                          <span className="block text-[9.5px] text-stone-500 font-normal leading-tight">{lm.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: TABLE & TOTALS */}
              {activeTab === 'table' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-2">
                      Table Header Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'minimal-line', label: 'Minimal Line' },
                        { id: 'filled-row', label: 'Tinted Row Fill' },
                        { id: 'rounded-pill', label: 'Rounded Standalone Pill' },
                        { id: 'espresso-block', label: 'Dark Espresso Block' },
                        { id: 'bold-solid', label: 'Bold Black Solid' },
                      ].map(th => (
                        <button
                          key={th.id}
                          onClick={() => setWorkingStyle(prev => ({ ...prev, tableHeaderStyle: th.id as TableHeaderStyle }))}
                          className={`p-3 rounded-xl border text-left text-xs font-semibold transition cursor-pointer ${
                            workingStyle.tableHeaderStyle === th.id
                              ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20'
                              : 'border-stone-200 bg-stone-50/60 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {th.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-2">
                      Table Item Rows
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'subtle-lines', label: 'Subtle Horizontal Rules' },
                        { id: 'card-rows', label: 'Individual White Cards' },
                        { id: 'clean-borderless', label: 'Clean Borderless' },
                        { id: 'full-grid', label: 'Full Grid Borders' },
                      ].map(tr => (
                        <button
                          key={tr.id}
                          onClick={() => setWorkingStyle(prev => ({ ...prev, tableRowStyle: tr.id as TableRowStyle }))}
                          className={`p-3 rounded-xl border text-left text-xs font-semibold transition cursor-pointer ${
                            workingStyle.tableRowStyle === tr.id
                              ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20'
                              : 'border-stone-200 bg-stone-50/60 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {tr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-2">
                      Grand Total Summary Box
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'clean-row', label: 'Clean Line Summary' },
                        { id: 'filled-card', label: 'Tinted Card Box' },
                        { id: 'standalone-pill', label: 'Standalone Rounded Pill' },
                        { id: 'brutalist-banner', label: 'Brutalist Black Banner' },
                      ].map(tb => (
                        <button
                          key={tb.id}
                          onClick={() => setWorkingStyle(prev => ({ ...prev, totalBoxStyle: tb.id as TotalBoxStyle }))}
                          className={`p-3 rounded-xl border text-left text-xs font-semibold transition cursor-pointer ${
                            workingStyle.totalBoxStyle === tb.id
                              ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20'
                              : 'border-stone-200 bg-stone-50/60 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {tb.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product & Service Image Settings */}
                  <div className="pt-4 border-t border-stone-200 space-y-3.5">
                    <label className="flex items-center justify-between cursor-pointer text-xs font-extrabold text-stone-800 bg-stone-50 p-3 rounded-xl border border-stone-200">
                      <div>
                        <span className="block font-bold text-stone-900">Show Item Image Thumbnails</span>
                        <span className="block text-[10px] text-stone-500 font-normal">Display product photos alongside item descriptions</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={workingStyle.showProductPhotos !== false}
                        onChange={e => setWorkingStyle(prev => ({ ...prev, showProductPhotos: e.target.checked }))}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                      />
                    </label>

                    {workingStyle.showProductPhotos !== false && (
                      <div>
                        <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider mb-2">
                          Image Corner Style
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'square', label: 'Square (0px)' },
                            { id: 'rounded', label: 'Rounded (12px)' },
                            { id: 'circle', label: 'Circle (Full)' },
                          ].map(ps => (
                            <button
                              key={ps.id}
                              type="button"
                              onClick={() => setWorkingStyle(prev => ({ ...prev, productPhotoRadius: ps.id as 'square' | 'rounded' | 'circle' }))}
                              className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition cursor-pointer ${
                                (workingStyle.productPhotoRadius || 'rounded') === ps.id
                                  ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20'
                                  : 'border-stone-200 bg-stone-50/60 text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              {ps.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Document Preview (7 cols) */}
          <div className="lg:col-span-7 bg-stone-200/60 p-4 sm:p-6 overflow-y-auto flex flex-col">
            <div className="flex-1 overflow-y-auto p-1 bg-stone-300/40 rounded-2xl flex items-center justify-center">
              <div className="w-full max-w-xl my-auto">
                <DocumentRenderer
                  documentType="quote"
                  documentNumber="QT-2026-001"
                  date="22 July 2026"
                  expiryOrDueDate="22 August 2026"
                  profile={profile}
                  customerName="Claudia Alves (Cape Curios Ltd)"
                  customerEmail="claudia@capecurios.co.za"
                  customerPhone="+27 (0) 72 389 4402"
                  customerAddress="Unit 14, The Watershed, Cape Town"
                  items={sampleItems}
                  subtotal={2225.00}
                  totalAmount={2225.00}
                  notes="50% deposit on acceptance. Delivery lead time 14 working days."
                  signOffMessage="Thank you for supporting artisanal craftsmanship!"
                  templateStyle={workingStyle}
                  printableId="preview-modal-quote-area"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Delete Confirmation Modal */}
      {themeToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4 animate-scaleIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">Delete Custom Theme</h3>
                <p className="text-xs text-stone-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100">
              Are you sure you want to delete <span className="font-bold text-stone-800">{themeToDelete.name}</span>? Quotes using this theme will revert to the default template.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setThemeToDelete(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCustomTemplate?.(themeToDelete.id);
                  setThemeToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete Theme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
