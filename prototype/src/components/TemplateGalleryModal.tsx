import React, { useState, useEffect, useRef } from 'react';
import { X, Palette, Sparkles, Plus, Check, Paintbrush, Search, Layout, Tag, Maximize2, Eye, Trash2 } from 'lucide-react';
import { QuoteTemplateStyle, BusinessProfile } from '../types';
import { STANDARD_QUOTE_TEMPLATES, resolveQuoteTemplate } from '../data/quoteTemplates';
import { DEFAULT_PROFILE } from '../data/defaultData';
import { DocumentRenderer, RenderItem } from './DocumentRenderer';

interface TemplateGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTemplateId: string;
  activeCustomStyle?: QuoteTemplateStyle;
  customTemplates: QuoteTemplateStyle[];
  profile: BusinessProfile;
  onSelectTemplate: (templateId: string, customStyle?: QuoteTemplateStyle) => void;
  onCreateNewTemplate: () => void;
  onRemixTemplate: (templateToRemix: QuoteTemplateStyle) => void;
  onDeleteCustomTemplate?: (templateId: string) => void;
}

const GALLERY_PREVIEW_ITEMS: RenderItem[] = [
  {
    id: '1',
    productName: 'Custom Product / Service Item',
    productDescription: 'Standard product description or specification details',
    quantity: 1,
    unitPrice: 1500.00,
    total: 1500.00,
    selectedCustomizations: {
      'Option': { value: 'Standard Variant', priceUplift: 0 },
    }
  },
  {
    id: '2',
    productName: 'Additional Service Line Item',
    productDescription: 'Secondary item description with unit pricing breakdown',
    quantity: 2,
    unitPrice: 250.00,
    total: 500.00
  }
];

const TemplateThumbnail: React.FC<{ 
  template: QuoteTemplateStyle; 
  profile: BusinessProfile;
  onFullscreenPreview?: () => void;
}> = ({ template, profile, onFullscreenPreview }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.44);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        if (width > 0) {
          setScale(width / 520);
        }
      }
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef}
      onClick={onFullscreenPreview}
      className="w-full aspect-[1/1.28] rounded-xl overflow-hidden border border-stone-200/90 shadow-2xs relative bg-white group-hover:shadow-md transition select-none cursor-pointer group/thumb"
    >
      <div 
        className="w-[520px] origin-top-left absolute top-0 left-0 pointer-events-none select-none"
        style={{ transform: `scale(${scale})` }}
      >
        <DocumentRenderer
          documentType="quote"
          documentNumber="QT-2026-042"
          date="24 Jul 2026"
          expiryOrDueDate="24 Aug 2026"
          profile={profile && profile.name ? profile : DEFAULT_PROFILE}
          customerName="Jane Doe"
          customerAddress="12 Long Street, Cape Town"
          items={GALLERY_PREVIEW_ITEMS}
          subtotal={2000.00}
          totalAmount={2000.00}
          notes="Deposit required on acceptance. Delivery lead time 14 working days."
          signOffMessage="Thank you for supporting local craft!"
          templateStyle={template}
          printableId={`gallery-preview-${template.id}`}
        />
      </div>

      {/* Hover Overlay with Fullscreen Button */}
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[1px] opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center p-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFullscreenPreview?.();
          }}
          className="bg-white hover:bg-stone-100 text-stone-900 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1.5 cursor-pointer transform translate-y-1 group-hover/thumb:translate-y-0"
        >
          <Maximize2 size={13} className="text-amber-700" />
          <span>Fullscreen Preview</span>
        </button>
      </div>
    </div>
  );
};

export const TemplateGalleryModal: React.FC<TemplateGalleryModalProps> = ({
  isOpen,
  onClose,
  activeTemplateId,
  activeCustomStyle,
  customTemplates,
  profile,
  onSelectTemplate,
  onCreateNewTemplate,
  onRemixTemplate,
  onDeleteCustomTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [fullscreenTemplate, setFullscreenTemplate] = useState<QuoteTemplateStyle | null>(null);
  const [themeToDelete, setThemeToDelete] = useState<QuoteTemplateStyle | null>(null);

  if (!isOpen) return null;

  // Guarantee isCustom flag for all customTemplates
  const formattedCustomTemplates = customTemplates.map(t => ({ ...t, isCustom: true }));
  const allTemplates = [...STANDARD_QUOTE_TEMPLATES, ...formattedCustomTemplates];

  const categories = ['All', 'Default', 'Custom'];

  const filteredTemplates = allTemplates.filter(t => {
    const matchesCategory = 
      selectedCategory === 'All' ? true :
      selectedCategory === 'Custom' ? t.isCustom :
      selectedCategory === 'Default' ? !t.isCustom : true;

    const matchesSearch = 
      !searchQuery.trim() || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const activeStyle = resolveQuoteTemplate(activeTemplateId, activeCustomStyle, customTemplates);

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-3xl border border-stone-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fadeIn">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-stone-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0 shadow-3xs">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                Document Template Gallery
                <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {allTemplates.length} Styles
                </span>
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Select a visual theme for quotes and invoices, or remix your own custom theme style
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                onCreateNewTemplate();
                onClose();
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition shadow-3xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>Create New Template</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-200/60 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-stone-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-amber-100 text-amber-900 border border-amber-300/80 shadow-3xs'
                    : 'bg-stone-100/70 text-stone-600 hover:bg-stone-200/60 border border-transparent'
                }`}
              >
                {cat === 'Custom' && customTemplates.length > 0 && (
                  <span className="mr-1 inline-block w-2 h-2 rounded-full bg-emerald-500" />
                )}
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              <Sparkles size={28} className="mx-auto text-amber-600/60" />
              <p className="text-xs font-bold text-stone-600">No templates found matching your search</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="text-xs font-extrabold text-amber-700 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {filteredTemplates.map(template => {
                const isSelected = activeStyle.id === template.id;

                return (
                  <div
                    key={template.id}
                    className={`rounded-2xl border transition p-3 flex flex-col justify-between gap-2.5 group relative ${
                      isSelected
                        ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-500/30 shadow-sm'
                        : 'border-stone-200 bg-white hover:border-amber-300 hover:bg-stone-50/50'
                    }`}
                  >
                    {/* Top Tag & Status */}
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-xs font-black text-stone-900 group-hover:text-amber-900 transition truncate">
                          {template.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {template.isCustom ? (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                            Custom
                          </span>
                        ) : (
                          <span className="text-[9px] bg-stone-100 text-stone-600 font-bold px-1.5 py-0.5 rounded border border-stone-200/80">
                            Default
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[9px] bg-amber-600 text-white font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Check size={10} /> Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Template Thumbnail */}
                    <TemplateThumbnail 
                      template={template} 
                      profile={profile} 
                      onFullscreenPreview={() => setFullscreenTemplate(template)}
                    />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTemplate(template.id, template.isCustom ? template : undefined);
                          onClose();
                        }}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-amber-700 text-white shadow-3xs'
                            : 'bg-stone-900 hover:bg-black text-white'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Use Template'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onRemixTemplate(template);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-stone-200/80 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                        title={template.isCustom ? "Edit this custom template" : "Remix and customize this template"}
                      >
                        <Paintbrush size={12} />
                        <span>{template.isCustom ? 'Edit' : 'Remix'}</span>
                      </button>

                      {template.isCustom && onDeleteCustomTemplate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setThemeToDelete(template);
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200/80 rounded-xl transition cursor-pointer shrink-0"
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
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex justify-between items-center shrink-0">
          <p className="text-[11px] text-stone-500 font-medium">
            Custom themes are saved locally and synced across quotes and invoices.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>

      {/* FULLSCREEN PREVIEW MODAL OVERLAY */}
      {fullscreenTemplate && (
        <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-md flex flex-col p-3 sm:p-6 overflow-hidden animate-fadeIn">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between bg-stone-900 text-white px-5 py-3 rounded-2xl mb-3 border border-stone-800 shadow-xl shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                <Layout size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{fullscreenTemplate.name}</span>
                  {fullscreenTemplate.isCustom && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded">
                      Custom Theme
                    </span>
                  )}
                </h3>
                <p className="text-xs text-stone-400">Full-size live document theme preview</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectTemplate(fullscreenTemplate.id, fullscreenTemplate.isCustom ? fullscreenTemplate : undefined);
                  setFullscreenTemplate(null);
                  onClose();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition shadow-3xs cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Use This Theme</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onRemixTemplate(fullscreenTemplate);
                  setFullscreenTemplate(null);
                  onClose();
                }}
                className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-stone-700"
              >
                <Paintbrush size={14} />
                <span>{fullscreenTemplate.isCustom ? 'Edit' : 'Remix'}</span>
              </button>

              {fullscreenTemplate.isCustom && onDeleteCustomTemplate && (
                <button
                  type="button"
                  onClick={() => setThemeToDelete(fullscreenTemplate)}
                  className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-rose-800/80"
                  title="Delete this custom theme"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setFullscreenTemplate(null)}
                className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition cursor-pointer ml-2"
                title="Close Fullscreen Preview"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Document Render Canvas Container */}
          <div className="flex-1 overflow-y-auto bg-stone-900/60 rounded-2xl p-4 sm:p-8 border border-stone-800/80 flex justify-center items-start scrollbar-thin">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-2 sm:p-4">
              <DocumentRenderer
                documentType="quote"
                documentNumber="QT-2026-042"
                date="24 Jul 2026"
                expiryOrDueDate="24 Aug 2026"
                profile={profile && profile.name ? profile : DEFAULT_PROFILE}
                customerName="Jane Doe"
                customerAddress="12 Long Street, Cape Town"
                customerEmail="jane.doe@example.com"
                items={GALLERY_PREVIEW_ITEMS}
                subtotal={2000.00}
                totalAmount={2000.00}
                notes="Deposit required on acceptance. Delivery lead time 14 working days."
                signOffMessage="Thank you for supporting local craft!"
                templateStyle={fullscreenTemplate}
                printableId={`fullscreen-preview-${fullscreenTemplate.id}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Theme Delete Confirmation Modal */}
      {themeToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-fadeIn">
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
                  if (fullscreenTemplate?.id === themeToDelete.id) {
                    setFullscreenTemplate(null);
                  }
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
