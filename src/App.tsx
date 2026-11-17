// ===== IMPORTS & DEPENDENCIES =====
import React, { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  FileArchive,
  FileCode,
  FileJson,
  FolderTree,
  HelpCircle,
  Layout,
  Monitor,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Upload,
} from 'lucide-react';
import { ElementorTreeView } from './components/ElementorTreeView';
import {
  buildAuthenticElementorSrcDoc,
  ElementorVisualPreview,
} from './components/ElementorVisualPreview';
import { ValidationReportView } from './components/ValidationReportView';
import { SAMPLE_HTML_TEMPLATES } from './data/sampleTemplates';
import { extractUploadedFiles } from './services/htmlParser';
import { runElementorConversionPipeline } from './services/pipeline';
import {
  ConversionResult,
  ConverterSettings,
  ElementorAddonType,
  ElementorTemplateType,
  ElementorVersionTarget,
  ExtractedSvgAsset,
} from './types/elementor';

// ===== CONFIGURATION & CONSTANTS =====
const DEFAULT_SETTINGS: ConverterSettings = {
  elementorVersion: '3.24+',
  enableFlexboxContainer: true,
  hasElementorPro: false,
  allowedAddons: [],
  templateTitle: 'gilaclick-single',
  templateType: 'page',
  includeHeaderFooter: true,
  scopePrefix: 'elementor-gilaclick-single',
  embedAssetsInPageJson: true,
  exactHtmlMatch: false,
  customFontFamily: '',
  optimizeMobileLayout: true,
};

type ActiveTab =
  | 'elementor-visual'
  | 'validation'
  | 'tree'
  | 'preview'
  | 'json'
  | 'extra-css'
  | 'extra-js'
  | 'svg-assets';
type PreviewViewport = 'split' | 'desktop' | 'tablet' | 'mobile';

// ===== CORE BUSINESS LOGIC =====

export default function App() {
  const [settings, setSettings] = useState<ConverterSettings>(DEFAULT_SETTINGS);
  const [rawHtmlInput, setRawHtmlInput] = useState<string>(
    SAMPLE_HTML_TEMPLATES[0].html
  );
  const [sourceFileName, setSourceFileName] = useState<string>(
    'gilaclick-single.html'
  );
  const [assetMap, setAssetMap] = useState<Map<string, string>>(new Map());
  const [inputMode, setInputMode] = useState<'upload' | 'editor'>('upload');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [conversionResult, setConversionResult] =
    useState<ConversionResult | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('elementor-visual');
  const [previewViewport, setPreviewViewport] =
    useState<PreviewViewport>('desktop');
  const [copiedType, setCopiedType] = useState<'json' | 'css' | 'js' | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const executeConversion = useCallback(
    async (
      htmlToConvert: string,
      fileNameToUse: string,
      currentSettings: ConverterSettings,
      currentAssets: Map<string, string>
    ) => {
      setIsProcessing(true);
      setErrorBanner(null);
      try {
        const res = await runElementorConversionPipeline(
          htmlToConvert,
          fileNameToUse,
          currentSettings,
          currentAssets
        );
        setConversionResult(res);
      } catch (err) {
        setErrorBanner(
          err instanceof Error
            ? err.message
            : 'خطایی در حین تحلیل و تبدیل فایل HTML رخ داد.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const loadGilaClickTemplate = useCallback(
    async (currentSettings: ConverterSettings) => {
      try {
        setIsProcessing(true);
        const resp = await fetch('/assets/aistudio/gilaclick-single_32693709.html');
        if (resp.ok) {
          const htmlText = await resp.text();
          setRawHtmlInput(htmlText);
          setSourceFileName('gilaclick-single.html');
          setAssetMap(new Map());
          await executeConversion(
            htmlText,
            'gilaclick-single.html',
            currentSettings,
            new Map()
          );
          return;
        }
      } catch {
        // Fallback to built-in sample if fetch fails
      }
      await executeConversion(
        SAMPLE_HTML_TEMPLATES[0].html,
        SAMPLE_HTML_TEMPLATES[0].fileName,
        currentSettings,
        new Map()
      );
    },
    [executeConversion]
  );

  const loadHamiTemplate = useCallback(
    async (currentSettings: ConverterSettings) => {
      try {
        setIsProcessing(true);
        const resp = await fetch(
          '/assets/aistudio/Paste_November_01__2026_-_8_16PM_855f4979'
        );
        if (resp.ok) {
          const htmlText = await resp.text();
          setRawHtmlInput(htmlText);
          setSourceFileName('hami-agency.html');
          setAssetMap(new Map());
          await executeConversion(
            htmlText,
            'hami-agency.html',
            currentSettings,
            new Map()
          );
          return;
        }
      } catch {
        // Fallback if fetch fails
      }
      await loadGilaClickTemplate(currentSettings);
    },
    [executeConversion, loadGilaClickTemplate]
  );

  const loadGilaClickFaqTemplate = useCallback(
    async (currentSettings: ConverterSettings) => {
      try {
        setIsProcessing(true);
        const resp = await fetch('/assets/aistudio/gilaclick-faq_4618ab0a.html');
        if (resp.ok) {
          const htmlText = await resp.text();
          setRawHtmlInput(htmlText);
          setSourceFileName('gilaclick-faq.html');
          setAssetMap(new Map());
          await executeConversion(
            htmlText,
            'gilaclick-faq.html',
            currentSettings,
            new Map()
          );
          return;
        }
      } catch {
        // Fallback if fetch fails
      }
      await loadHamiTemplate(currentSettings);
    },
    [executeConversion, loadHamiTemplate]
  );

  const loadHamiWebmasterTemplate = useCallback(
    async (currentSettings: ConverterSettings) => {
      try {
        setIsProcessing(true);
        const resp = await fetch(
          '/assets/aistudio/Qwen_html_20261117_p4wxduxg1_45154f7f.html'
        );
        if (resp.ok) {
          const htmlText = await resp.text();
          setRawHtmlInput(htmlText);
          setSourceFileName('Qwen_html_20261117_p4wxduxg1.html');
          setAssetMap(new Map());
          await executeConversion(
            htmlText,
            'Qwen_html_20261117_p4wxduxg1.html',
            currentSettings,
            new Map()
          );
          return;
        }
      } catch {
        // Fallback if fetch fails
      }
      await loadGilaClickFaqTemplate(currentSettings);
    },
    [executeConversion, loadGilaClickFaqTemplate]
  );

  const loadGandomTemplate = useCallback(
    async (currentSettings: ConverterSettings) => {
      try {
        setIsProcessing(true);
        const resp = await fetch('/assets/aistudio/home_a42a5106.html');
        if (resp.ok) {
          const htmlText = await resp.text();
          setRawHtmlInput(htmlText);
          setSourceFileName('home.html');
          setAssetMap(new Map());
          await executeConversion(
            htmlText,
            'home.html',
            currentSettings,
            new Map()
          );
          return;
        }
      } catch {
        // Fallback if fetch fails
      }
      await loadHamiWebmasterTemplate(currentSettings);
    },
    [executeConversion, loadHamiWebmasterTemplate]
  );

  // Load user's latest attached Gandom Fantasy template (home.html) on initial mount
  useEffect(() => {
    const initialGandomSettings: ConverterSettings = {
      ...settings,
      templateTitle: 'home',
      scopePrefix: 'elementor-home',
    };
    setSettings(initialGandomSettings);
    void loadGandomTemplate(initialGandomSettings);
  }, []);

  const handleFileProcess = async (file: File) => {
    setErrorBanner(null);
    setIsProcessing(true);
    try {
      const bundle = await extractUploadedFiles(file);
      const cleanTitle = bundle.fileName.replace(/\.(html?|zip)$/i, '');
      const cleanSlug =
        cleanTitle.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'page';
      const updatedSettings: ConverterSettings = {
        ...settings,
        templateTitle: cleanTitle || settings.templateTitle,
        scopePrefix: `elementor-${cleanSlug}`,
      };
      setRawHtmlInput(bundle.htmlContent);
      setSourceFileName(bundle.fileName);
      setAssetMap(bundle.assetMap);
      setSettings(updatedSettings);

      await executeConversion(
        bundle.htmlContent,
        bundle.fileName,
        updatedSettings,
        bundle.assetMap
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'خطا در خواندن فایل آپلودشده.'
      );
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await handleFileProcess(droppedFile);
    }
  };

  const triggerTextFileDownload = (
    content: string,
    fileName: string,
    mimeType: string
  ) => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!conversionResult || !conversionResult.report.canDownload) return;
    triggerTextFileDownload(
      conversionResult.jsonString,
      'page.json',
      'application/json'
    );
  };

  const handleDownloadExtraCss = () => {
    if (!conversionResult) return;
    triggerTextFileDownload(conversionResult.extraCss, 'extra.css', 'text/css');
  };

  const handleDownloadExtraJs = () => {
    if (!conversionResult) return;
    triggerTextFileDownload(
      conversionResult.extraJs,
      'extra.js',
      'application/javascript'
    );
  };

  const handleDownloadSingleSvg = (svgAsset: ExtractedSvgAsset) => {
    triggerTextFileDownload(
      svgAsset.svgContent,
      svgAsset.fileName,
      'image/svg+xml'
    );
  };

  const handleDownloadSvgAssetsZip = async () => {
    if (!conversionResult || conversionResult.extractedSvgs.length === 0) return;
    const zip = new JSZip();
    for (const svgAsset of conversionResult.extractedSvgs) {
      zip.file(svgAsset.relativePath, svgAsset.svgContent);
    }
    const localPreviewHtml = buildAuthenticElementorSrcDoc(
      conversionResult.json,
      conversionResult.extraCss,
      conversionResult.extraJs,
      true,
      false,
      conversionResult.extractedSvgs,
      false
    );
    zip.file('local-preview.html', localPreviewHtml);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName =
      sourceFileName
        .replace(/\.(html?|zip)$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-') || 'elementor-hybrid';
    link.href = url;
    link.download = `${safeName}-local-svg-assets.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllBundleZip = async () => {
    if (!conversionResult || !conversionResult.report.canDownload) return;
    const zip = new JSZip();
    zip.file('page.json', conversionResult.jsonString);
    zip.file('extra.css', conversionResult.extraCss);
    zip.file('extra.js', conversionResult.extraJs);

    // Include all extracted standalone .svg files in assets/svg/*.svg
    for (const svgAsset of conversionResult.extractedSvgs) {
      zip.file(svgAsset.relativePath, svgAsset.svgContent);
    }

    // Include a standalone local runner (local-preview.html) that loads assets/svg/*.svg locally
    const localPreviewHtml = buildAuthenticElementorSrcDoc(
      conversionResult.json,
      conversionResult.extraCss,
      conversionResult.extraJs,
      true,
      false,
      conversionResult.extractedSvgs,
      false
    );
    zip.file('local-preview.html', localPreviewHtml);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName =
      sourceFileName
        .replace(/\.(html?|zip)$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-') || 'elementor-hybrid';
    link.href = url;
    link.download = `${safeName}-hybrid-bundle.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyContent = async (
    text: string,
    type: 'json' | 'css' | 'js'
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setErrorBanner('امکان کپی خودکار در کلیپ‌بورد مرورگر وجود ندارد.');
    }
  };

  const handleToggleAddon = (addon: ElementorAddonType) => {
    const exists = settings.allowedAddons.includes(addon);
    const updatedAddons = exists
      ? settings.allowedAddons.filter((a) => a !== addon)
      : [...settings.allowedAddons, addon];
    const nextSettings = { ...settings, allowedAddons: updatedAddons };
    setSettings(nextSettings);
    void executeConversion(rawHtmlInput, sourceFileName, nextSettings, assetMap);
  };

  const updateSettingAndReconvert = <K extends keyof ConverterSettings>(
    key: K,
    value: ConverterSettings[K]
  ) => {
    const nextSettings: ConverterSettings = {
      ...settings,
      [key]: value,
    };
    if (
      key === 'elementorVersion' &&
      value !== '3.24+' &&
      nextSettings.enableFlexboxContainer
    ) {
      nextSettings.enableFlexboxContainer = false;
    }
    setSettings(nextSettings);
    void executeConversion(rawHtmlInput, sourceFileName, nextSettings, assetMap);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          مبدل مهندسی HTML به Elementor (حالت ترکیبی: page.json + extra.css + extra.js)
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
          <a
            href="#upload-section"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            آپلود و ورودی
          </a>
          <a
            href="#settings-section"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            تنظیمات حالت ترکیبی
          </a>
          <a
            href="#workspace-section"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            خروجی و گزارش سه‌بخشی
          </a>
          <a
            href="#import-guide"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            راهنمای Import
          </a>
        </nav>

        {/* Zone 3: Primary Download Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadJson}
            disabled={!conversionResult || !conversionResult.report.canDownload}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>دانلود page.json</span>
          </button>
        </div>
      </header>

      {/* Main Content Container (1440px baseline) */}
      <main
        id="top"
        className="max-w-[1400px] w-full mx-auto px-6 py-8 space-y-8 flex-1"
      >
        {/* Error Notification Banner */}
        {errorBanner && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between gap-4">
            <span>❌ {errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-red-700 hover:text-red-950 font-semibold whitespace-nowrap shrink-0"
            >
              بستن پیام
            </button>
          </div>
        )}

        {/* Top Grid: (1) Upload/Input & (2) Settings */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* (1) Upload & HTML Input Zone */}
          <div
            id="upload-section"
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-base font-bold text-slate-900">
                  ۱. بارگذاری فایل HTML یا بسته ZIP
                </h1>
                {/* Input Mode Segmented Switch */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      inputMode === 'upload'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    آپلود فایل (Drag & Drop)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('editor')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      inputMode === 'editor'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ویرایشگر کد HTML
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                در حالت ترکیبی (Hybrid Mode)، ساختار و استایل‌های اصلی به ویجت‌های بومی Elementor (
                <code className="text-slate-700">page.json</code>) تبدیل می‌شوند، کلاس‌ها در{' '}
                <code className="text-slate-700">_css_classes</code> حفظ می‌گردند و افکت‌های پیشرفته (
                <code className="text-slate-700">@keyframes</code>،{' '}
                <code className="text-slate-700">::before/::after</code>،{' '}
                <code className="text-slate-700">backdrop-filter</code>) در{' '}
                <code className="text-slate-700">extra.css</code> و رفتارها در{' '}
                <code className="text-slate-700">extra.js</code> استخراج می‌شوند.
              </p>
            </div>

            {inputMode === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[210px] ${
                  isDragging
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-500 bg-slate-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.htm,.zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileProcess(f);
                  }}
                />
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-1">
                  فایل HTML یا ZIP را اینجا رها کنید یا برای انتخاب کلیک کنید
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <FileCode className="w-3.5 h-3.5" /> HTML / HTM
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1">
                    <FileArchive className="w-3.5 h-3.5" /> ZIP (HTML + CSS + Images)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    فایل فعلی: {sourceFileName}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={rawHtmlInput}
                  onChange={(e) => setRawHtmlInput(e.target.value)}
                  dir="ltr"
                  rows={8}
                  placeholder="<!DOCTYPE html><html>...</html>"
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      void executeConversion(
                        rawHtmlInput,
                        sourceFileName,
                        settings,
                        assetMap
                      )
                    }
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>تحلیل مجدد کدهای HTML</span>
                  </button>
                </div>
              </div>
            )}

            {/* Built-in Ready Samples for Instant Testing */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-600">
                انتخاب قالب آماده:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextSettings = {
                      ...settings,
                      templateTitle: 'home',
                      scopePrefix: 'elementor-home',
                    };
                    setSettings(nextSettings);
                    void loadGandomTemplate(nextSettings);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    sourceFileName === 'home.html'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  فانتزیجات گندم (home.html)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextSettings = {
                      ...settings,
                      templateTitle: 'gilaclick-faq',
                      scopePrefix: 'elementor-gilaclick-faq',
                    };
                    setSettings(nextSettings);
                    void loadGilaClickFaqTemplate(nextSettings);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    sourceFileName === 'gilaclick-faq.html'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  سوالات متداول گیلاکلیک (gilaclick-faq.html)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextSettings = {
                      ...settings,
                      templateTitle: 'hami-agency',
                      scopePrefix: 'elementor-hami-agency',
                    };
                    setSettings(nextSettings);
                    void loadHamiTemplate(nextSettings);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    sourceFileName === 'hami-agency.html'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  قالب آژانس حامی (hami-agency.html)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextSettings = {
                      ...settings,
                      templateTitle: 'gilaclick-single',
                      scopePrefix: 'elementor-gilaclick-single',
                    };
                    setSettings(nextSettings);
                    void loadGilaClickTemplate(nextSettings);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    sourceFileName === 'gilaclick-single.html'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  قالب گیلاکلیک (gilaclick-single.html)
                </button>
                {SAMPLE_HTML_TEMPLATES.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => {
                      setRawHtmlInput(sample.html);
                      setSourceFileName(sample.fileName);
                      setAssetMap(new Map());
                      const nextSettings = {
                        ...settings,
                        templateTitle: sample.name,
                        scopePrefix: `elementor-${sample.id}`,
                      };
                      setSettings(nextSettings);
                      void executeConversion(
                        sample.html,
                        sample.fileName,
                        nextSettings,
                        new Map()
                      );
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      sourceFileName === sample.fileName
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {sample.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* (2) Settings Panel */}
          <div
            id="settings-section"
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    ۲. تنظیمات حالت ترکیبی و سازگاری Elementor
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  Hybrid v0.4
                </span>
              </div>

              {/* Template Title, Type & Scope Prefix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    عنوان قالب (Title)
                  </label>
                  <input
                    type="text"
                    value={settings.templateTitle}
                    onChange={(e) =>
                      updateSettingAndReconvert('templateTitle', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    اسکوپ ایزوله (extra.css)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={settings.scopePrefix}
                    onChange={(e) =>
                      updateSettingAndReconvert('scopePrefix', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    نوع قالب (Type)
                  </label>
                  <select
                    value={settings.templateType}
                    onChange={(e) =>
                      updateSettingAndReconvert(
                        'templateType',
                        e.target.value as ElementorTemplateType
                      )
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="page">برگه کامل (page)</option>
                    <option value="section">بخش مجزا (section)</option>
                  </select>
                </div>
              </div>

              {/* Local Site Font Override Input */}
              <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-indigo-950">
                    نام فونت لوکال سایت وردپرس (اعمال سراسری روی تمام متون و ویجت‌های Elementor)
                  </label>
                  {settings.customFontFamily && (
                    <button
                      type="button"
                      onClick={() => updateSettingAndReconvert('customFontFamily', '')}
                      className="text-[11px] font-medium text-rose-600 hover:text-rose-700"
                    >
                      پاک کردن فونت سفارشی
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="مثلاً: IRANSansX یا YekanBakh یا Vazirmatn یا Dana"
                    value={settings.customFontFamily || ''}
                    onChange={(e) =>
                      updateSettingAndReconvert('customFontFamily', e.target.value)
                    }
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    {['Vazirmatn', 'IRANSansX', 'YekanBakh', 'Dana', 'Peyda'].map((fontName) => (
                      <button
                        key={fontName}
                        type="button"
                        onClick={() => updateSettingAndReconvert('customFontFamily', fontName)}
                        className={`px-2 py-1.5 text-[11px] font-mono rounded-md border transition-colors ${
                          settings.customFontFamily === fontName
                            ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                        }`}
                      >
                        {fontName}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                  با وارد کردن نام فونت لوکال نصب‌شده در قالب وردپرس/المنتور خود، تمام تیترها، متون، دکمه‌ها، آکاردئون‌ها، متغیرهای CSS و <code className="font-mono">typography_font_family</code> در فایل <code className="font-mono">page.json</code> و <code className="font-mono">extra.css</code> با همین فونت تولید می‌شوند.
                </p>
              </div>

              {/* 1:1 Exact HTML Match vs Native Widgets Mode Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  استراتژی تبدیل ساختار به Elementor JSON
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSettingAndReconvert('exactHtmlMatch', true)
                    }
                    className={`p-2.5 rounded-lg border text-right transition-colors ${
                      settings.exactHtmlMatch !== false
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>۱. تطابق ۱۰۰٪ دقیق با HTML (Exact Match)</span>
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-600 text-white font-semibold">
                        پیش‌فرض
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      حفظ عین‌به‌عین تمام تگ‌ها، گریدها، پدینگ‌ها، SVGها، انیمیشن‌ها و JS بدون هیچ‌گونه تغییر ظاهری در المنتور
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateSettingAndReconvert('exactHtmlMatch', false)
                    }
                    className={`p-2.5 rounded-lg border text-right transition-colors ${
                      settings.exactHtmlMatch === false
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">
                      ۲. تفکیک به ویجت‌های بومی (Native Widgets)
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      تبدیل اجزا به ویجت‌های مجزای Heading، Button، Text Editor و Image برای ویرایش تک‌به‌تک
                    </p>
                  </button>
                </div>
              </div>

              {/* Elementor Version Target */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  نسخه هدف Elementor
                </label>
                <select
                  value={settings.elementorVersion}
                  onChange={(e) =>
                    updateSettingAndReconvert(
                      'elementorVersion',
                      e.target.value as ElementorVersionTarget
                    )
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="unknown">
                    نامشخص (پیش‌فرض — فقط Section → Column → Widget)
                  </option>
                  <option value="3.23.1">
                    نسخه ≤ 3.23.1 (ساختار کلاسیک Section و Inner Section)
                  </option>
                  <option value="3.24+">
                    نسخه 3.24 به بالا (پشتیبانی از Flexbox Container در صورت فعال بودن)
                  </option>
                </select>
              </div>

              {/* Toggles: Include Header/Footer, Flexbox Container & Elementor Pro */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {/* Requirement 1: Include Header/Footer (Default: OFF) */}
                <label
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    settings.includeHeaderFooter
                      ? 'border-indigo-600 bg-indigo-50/40'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={settings.includeHeaderFooter}
                    onChange={(e) =>
                      updateSettingAndReconvert(
                        'includeHeaderFooter',
                        e.target.checked
                      )
                    }
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-800">
                      شامل هدر/فوتر
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      پیش‌فرض: خاموش (حذف header/footer)
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    settings.elementorVersion !== '3.24+'
                      ? 'border-slate-200 bg-slate-100/70 opacity-60 cursor-not-allowed'
                      : settings.enableFlexboxContainer
                      ? 'border-indigo-600 bg-indigo-50/40'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={settings.enableFlexboxContainer}
                    disabled={settings.elementorVersion !== '3.24+'}
                    onChange={(e) =>
                      updateSettingAndReconvert(
                        'enableFlexboxContainer',
                        e.target.checked
                      )
                    }
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-800">
                      Flexbox Container
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {settings.elementorVersion !== '3.24+'
                        ? 'فقط در نسخه 3.24+'
                        : 'elType: container'}
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    settings.hasElementorPro
                      ? 'border-indigo-600 bg-indigo-50/40'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={settings.hasElementorPro}
                    onChange={(e) =>
                      updateSettingAndReconvert(
                        'hasElementorPro',
                        e.target.checked
                      )
                    }
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-800">
                      Elementor Pro
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      پیش‌فرض: خیر (رایگان)
                    </div>
                  </div>
                </label>
              </div>

              {/* Smart Mobile Layout & Dimensions Optimization Toggle */}
              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                  settings.optimizeMobileLayout !== false
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={settings.optimizeMobileLayout !== false}
                  onChange={(e) =>
                    updateSettingAndReconvert(
                      'optimizeMobileLayout',
                      e.target.checked
                    )
                  }
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                />
                <div>
                  <div className="font-bold text-slate-900">
                    بهینه‌سازی هوشمند ابعاد و چیدمان موبایل (promo-card، هدر و trust-section)
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    جلوگیری از فشردگی عمودی متون و دکمه‌های کپسولی در بنرهای تبلیغاتی (
                    <code className="font-mono">promo-card--desk</code> /{' '}
                    <code className="font-mono">promo-card--gift</code>)، حفظ ابعاد دقیق آیکن‌های{' '}
                    <code className="font-mono">trust-section</code> و تنظیم فاصله‌های استاندارد هدر در نمایشگر موبایل
                  </div>
                </div>
              </label>

              {/* All-in-One In-Page CSS/JS Embedding Toggle */}
              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                  settings.embedAssetsInPageJson !== false
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={settings.embedAssetsInPageJson !== false}
                  onChange={(e) =>
                    updateSettingAndReconvert(
                      'embedAssetsInPageJson',
                      e.target.checked
                    )
                  }
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <div>
                  <div className="font-bold text-slate-900">
                    جاسازی خودکار extra.css و extra.js در داخل خود برگه (page.json یکپارچه)
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    با فعال بودن این گزینه، تمام استایل‌ها و اسکریپت‌ها مستقیماً داخل خود برگه (بلوک #hybrid-inline-assets در انتهای page.json) قرار می‌گیرند و دیگر نیازی به خروج از برگه یا افزونه جانبی نیست.
                  </div>
                </div>
              </label>

              {/* Third-party Addons (Default: None) */}
              <div className="space-y-1.5 pt-1">
                <span className="block text-xs font-medium text-slate-700">
                  افزونه‌های جانبی مجاز (پیش‌فرض: هیچ‌کدام)
                </span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'essential-addons', label: 'Essential Addons' },
                      { id: 'happy-addons', label: 'Happy Addons' },
                      { id: 'elements-kit', label: 'ElementsKit' },
                    ] as Array<{ id: ElementorAddonType; label: string }>
                  ).map((addon) => {
                    const active = settings.allowedAddons.includes(addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => handleToggleAddon(addon.id)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-medium'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {addon.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                مدل خروجی:{' '}
                <strong className="text-slate-800">
                  {settings.elementorVersion === '3.24+' &&
                  settings.enableFlexboxContainer
                    ? 'Flexbox Container'
                    : 'Section → Column → Widget'}
                </strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  void executeConversion(
                    rawHtmlInput,
                    sourceFileName,
                    settings,
                    assetMap
                  )
                }
                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`}
                />
                <span>بروزرسانی خروجی</span>
              </button>
            </div>
          </div>
        </section>

        {/* Full-Width KPI & 3-File Hybrid Download Bar (Requirement 9) */}
        {conversionResult && (
          <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 flex-1">
              <div className="space-y-0.5">
                <div className="text-xs text-slate-500">
                  {settings.enableFlexboxContainer ? 'کانتینرها' : 'سکشن‌های اصلی'}
                </div>
                <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                  {settings.enableFlexboxContainer
                    ? conversionResult.report.counts.containers
                    : conversionResult.report.counts.sections}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs text-slate-500">سکشن‌های داخلی (Grid)</div>
                <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                  {conversionResult.report.counts.innerSections}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs text-slate-500">مجموع ستون‌ها</div>
                <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                  {conversionResult.report.counts.columns}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs text-slate-500">ویجت‌های بومی</div>
                <div className="text-xl font-bold text-indigo-600 font-mono tabular-nums">
                  {conversionResult.report.counts.widgets}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs text-slate-500">فایل‌های SVG لوکال</div>
                <div className="text-xl font-bold text-emerald-600 font-mono tabular-nums">
                  {conversionResult.extractedSvgs.length}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs text-slate-500">قوانین extra.css</div>
                <div className="text-xl font-bold text-amber-600 font-mono tabular-nums">
                  {conversionResult.report.counts.extractedCssRules}
                </div>
              </div>
            </div>

            {/* Quick Local Font Input Before Export + Downloadable Files */}
            <div className="flex flex-col gap-3 shrink-0 border-t xl:border-t-0 pt-4 xl:pt-0 border-slate-100">
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                  فونت لوکال سایت (قبل از خروجی):
                </span>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="نام فونت لوکال (مثلاً IRANSansX، YekanBakh، Vazirmatn)"
                  value={settings.customFontFamily || ''}
                  onChange={(e) =>
                    updateSettingAndReconvert('customFontFamily', e.target.value)
                  }
                  className="w-56 sm:w-64 px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <div className="flex flex-wrap items-center gap-1">
                  {['Vazirmatn', 'IRANSansX', 'YekanBakh', 'Dana'].map((fn) => (
                    <button
                      key={fn}
                      type="button"
                      onClick={() => updateSettingAndReconvert('customFontFamily', fn)}
                      className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors ${
                        settings.customFontFamily === fn
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {fn}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  disabled={!conversionResult.report.canDownload}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <FileJson className="w-4 h-4" />
                  <span>
                    {settings.embedAssetsInPageJson !== false
                      ? '۱. دانلود page.json (بدون کد خام SVG)'
                      : '۱. دانلود page.json'}
                  </span>
                </button>

                {conversionResult.extractedSvgs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadSvgAssetsZip()}
                    className="px-4 py-2.5 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <FileCode className="w-4 h-4 text-teal-700" />
                    <span>
                      دانلود پوشه SVG لوکال ({conversionResult.extractedSvgs.length} فایل)
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadExtraCss}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>۲. دانلود extra.css</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadExtraJs}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Code2 className="w-4 h-4 text-amber-600" />
                  <span>۳. دانلود extra.js</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleDownloadAllBundleZip()}
                  disabled={!conversionResult.report.canDownload}
                  className="px-4 py-2.5 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <FileArchive className="w-4 h-4 text-emerald-700" />
                  <span>
                    دانلود پکیج کامل لوکال (ZIP + پوشه SVG + پیش‌نمایش لوکال)
                  </span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Main Workspace & Output Section */}
        {conversionResult && (
          <section
            id="workspace-section"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Main Inspection Area (Full 12-Col on Visual Simulator & HTML Preview, 8-Col on Code/Report Tabs) */}
            <div
              className={`${
                activeTab === 'elementor-visual' || activeTab === 'preview'
                  ? 'lg:col-span-12'
                  : 'lg:col-span-8'
              } space-y-4`}
            >
              {/* Segmented Workspace Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-200/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('validation')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'validation'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>گزارش حالت ترکیبی و اعتبارسنجی</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('elementor-visual')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'elementor-visual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layout className="w-4 h-4 text-indigo-600" />
                  <span>شبیه‌ساز بصری Elementor (دسکتاپ + موبایل)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('tree')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'tree'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FolderTree className="w-4 h-4 text-indigo-600" />
                  <span>درخت ساختار</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('json')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'json'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileJson className="w-4 h-4 text-indigo-600" />
                  <span>page.json</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('extra-css')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'extra-css'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>extra.css</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('extra-js')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'extra-js'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code2 className="w-4 h-4 text-amber-600" />
                  <span>extra.js</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('svg-assets')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'svg-assets'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileCode className="w-4 h-4 text-teal-600" />
                  <span>
                    فایل‌های SVG لوکال ({conversionResult.extractedSvgs.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'preview'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-4 h-4 text-sky-600" />
                  <span>HTML اصلی</span>
                </button>
              </div>

              {/* Active Tab Viewport */}
              {activeTab === 'validation' && (
                <ValidationReportView report={conversionResult.report} />
              )}

              {activeTab === 'elementor-visual' && (
                <ElementorVisualPreview
                  template={conversionResult.json}
                  extraCss={conversionResult.extraCss}
                  extraJs={conversionResult.extraJs}
                  extractedSvgs={conversionResult.extractedSvgs}
                />
              )}

              {activeTab === 'svg-assets' && (
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900">
                        فایل‌های SVG استخراج‌شده به‌صورت لوکال (بدون کد خام SVG در JSON)
                      </div>
                      <p className="text-[11px] text-slate-500">
                        تمامی المان‌های SVG از کدهای درون‌خطی خارج شده و به فایل‌های مستقل در مسیر{' '}
                        <code dir="ltr" className="text-indigo-700 font-mono">
                          assets/svg/*.svg
                        </code>{' '}
                        و ویجت بومی Image المنتور با ابعاد دقیق Computed Style تبدیل شدند.
                      </p>
                    </div>
                    {conversionResult.extractedSvgs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleDownloadSvgAssetsZip()}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <FileArchive className="w-3.5 h-3.5" />
                        <span>
                          دانلود همه فایل‌های SVG + اجرای لوکال (ZIP)
                        </span>
                      </button>
                    )}
                  </div>

                  {conversionResult.extractedSvgs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      هیچ المان SVG در فایل HTML ورودی یافت نشد.
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {conversionResult.extractedSvgs.map((svgAsset) => (
                        <div
                          key={svgAsset.id}
                          className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-2 shrink-0 shadow-2xs">
                              <img
                                src={svgAsset.dataUrl}
                                alt={svgAsset.fileName}
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                dir="ltr"
                                className="text-xs font-mono font-semibold text-slate-900 truncate"
                                title={svgAsset.relativePath}
                              >
                                {svgAsset.fileName}
                              </div>
                              <div
                                dir="ltr"
                                className="text-[11px] font-mono text-slate-500 truncate"
                              >
                                {svgAsset.relativePath}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-indigo-700">
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200">
                                  {svgAsset.widthPx}×{svgAsset.heightPx}px
                                </span>
                                <span className="text-slate-400">
                                  viewBox: {svgAsset.viewBox}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                            <span className="text-[11px] text-slate-500 truncate">
                              بخش: <code className="font-mono">{svgAsset.contextLabel}</code>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleSvg(svgAsset)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <Download className="w-3 h-3" />
                              <span>دانلود .svg</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tree' && (
                <ElementorTreeView nodes={conversionResult.json.content} />
              )}

              {activeTab === 'preview' && (
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-slate-800">
                      پیش‌نمایش زنده HTML ورودی در محیط ایزوله (Sandbox Iframe)
                    </span>
                    <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setPreviewViewport('split')}
                        className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                          previewViewport === 'split'
                            ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>دسکتاپ + موبایل (همزمان)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewViewport('desktop')}
                        className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                          previewViewport === 'desktop'
                            ? 'bg-white text-slate-900 font-medium shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>دسکتاپ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewViewport('tablet')}
                        className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                          previewViewport === 'tablet'
                            ? 'bg-white text-slate-900 font-medium shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Tablet className="w-3.5 h-3.5" />
                        <span>تبلت (768px)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewViewport('mobile')}
                        className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                          previewViewport === 'mobile'
                            ? 'bg-white text-slate-900 font-medium shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>موبایل (375px)</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-100 overflow-x-auto">
                    {previewViewport === 'split' ? (
                      <div className="flex flex-col xl:flex-row items-start gap-6">
                        <div className="flex-1 w-full min-w-[760px]">
                          <div className="mb-2 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                            <span>نمای دسکتاپ HTML اصلی</span>
                          </div>
                          <iframe
                            title="پیش‌نمایش دسکتاپ قالب HTML"
                            sandbox="allow-same-origin allow-scripts"
                            srcDoc={conversionResult.sanitizedPreviewHtml}
                            style={{ width: '100%', height: '760px' }}
                            className="bg-white rounded-xl border border-slate-300 shadow-xs"
                          />
                        </div>
                        <div className="shrink-0 mx-auto xl:mx-0">
                          <div className="mb-2 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                            <span>نمای موبایل HTML اصلی (375px)</span>
                          </div>
                          <iframe
                            title="پیش‌نمایش موبایل قالب HTML"
                            sandbox="allow-same-origin allow-scripts"
                            srcDoc={conversionResult.sanitizedPreviewHtml}
                            style={{ width: '375px', height: '760px' }}
                            className="bg-white rounded-[28px] border-[6px] border-slate-800 shadow-xl"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <iframe
                          title="پیش‌نمایش قالب HTML"
                          sandbox="allow-same-origin allow-scripts"
                          srcDoc={conversionResult.sanitizedPreviewHtml}
                          style={{
                            width:
                              previewViewport === 'desktop'
                                ? '100%'
                                : previewViewport === 'tablet'
                                ? '768px'
                                : '375px',
                            height: '760px',
                          }}
                          className="bg-white rounded-xl border border-slate-200 transition-all duration-150"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'json' && (
                <div className="border border-slate-200 rounded-xl bg-slate-900 text-slate-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                      <span>page.json</span>
                      <span aria-hidden="true">·</span>
                      <span>version: &quot;0.4&quot;</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyContent(
                            conversionResult.jsonString,
                            'json'
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        {copiedType === 'json' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>کپی شد</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>کپی page.json</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadJson}
                        className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>دانلود page.json</span>
                      </button>
                    </div>
                  </div>
                  <pre
                    dir="ltr"
                    className="p-4 text-xs font-mono text-slate-200 overflow-y-auto max-h-[540px] leading-relaxed"
                  >
                    {conversionResult.jsonString}
                  </pre>
                </div>
              )}

              {activeTab === 'extra-css' && (
                <div className="border border-slate-200 rounded-xl bg-slate-900 text-slate-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                      <span>extra.css</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {conversionResult.report.counts.extractedCssRules} قوانین ایزوله
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyContent(
                            conversionResult.extraCss,
                            'css'
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        {copiedType === 'css' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>کپی شد</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>کپی extra.css</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadExtraCss}
                        className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>دانلود extra.css</span>
                      </button>
                    </div>
                  </div>
                  <pre
                    dir="ltr"
                    className="p-4 text-xs font-mono text-slate-200 overflow-y-auto max-h-[540px] leading-relaxed"
                  >
                    {conversionResult.extraCss}
                  </pre>
                </div>
              )}

              {activeTab === 'extra-js' && (
                <div className="border border-slate-200 rounded-xl bg-slate-900 text-slate-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                      <span>extra.js</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {conversionResult.report.counts.extractedJsBlocks} اسکریپت رفتاری
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyContent(conversionResult.extraJs, 'js')
                        }
                        className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        {copiedType === 'js' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>کپی شد</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>کپی extra.js</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadExtraJs}
                        className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>دانلود extra.js</span>
                      </button>
                    </div>
                  </div>
                  <pre
                    dir="ltr"
                    className="p-4 text-xs font-mono text-slate-200 overflow-y-auto max-h-[540px] leading-relaxed"
                  >
                    {conversionResult.extraJs}
                  </pre>
                </div>
              )}
            </div>

            {/* Step-by-Step Hybrid Mode Elementor Import Guide */}
            <aside
              id="import-guide"
              className={`${
                activeTab === 'elementor-visual' || activeTab === 'preview'
                  ? 'lg:col-span-12'
                  : 'lg:col-span-4 sticky top-20'
              } bg-white border border-slate-200 rounded-xl p-6 space-y-5`}
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">
                  راهنمای استفاده از ۳ فایل خروجی در وردپرس
                </h3>
              </div>

              <ol
                className={`grid grid-cols-1 ${
                  activeTab === 'elementor-visual' || activeTab === 'preview'
                    ? 'md:grid-cols-3 gap-6'
                    : 'gap-4'
                } text-xs text-slate-600 leading-relaxed`}
              >
                <li className="space-y-1">
                  <div className="font-semibold text-slate-900">
                    ۰۱. درون‌ریزی فایل page.json در Elementor
                  </div>
                  <p>
                    در پیشخوان وردپرس به مسیر{' '}
                    <code className="text-slate-800">
                      Templates &gt; Saved Templates &gt; Import Templates
                    </code>{' '}
                    بروید و فایل <strong className="text-slate-800">page.json</strong> را آپلود کنید.
                  </p>
                </li>

                <li className="space-y-1">
                  <div className="font-semibold text-slate-900">
                    ۰۲. افزودن فایل extra.css (افکت‌ها، گرادیانت‌ها و فونت‌ها)
                  </div>
                  <p>
                    محتوای فایل <strong className="text-slate-800">extra.css</strong> را در بخش{' '}
                    <strong className="text-slate-800">
                      نمایش &gt; سفارشی‌سازی &gt; CSS اضافی
                    </strong>{' '}
                    (یا در Elementor &gt; Site Settings &gt; Custom CSS) قرار دهید. همچنین عبارت{' '}
                    <code className="text-indigo-700">{'{{FONT_URL}}'}</code> را با مسیر پوشه فونت‌های آپلودشده جایگزین کنید.
                  </p>
                </li>

                <li className="space-y-1">
                  <div className="font-semibold text-slate-900">
                    ۰۳. افزودن فایل extra.js (انیمیشن‌های رفتاری و مدارها)
                  </div>
                  <p>
                    کدهای فایل <strong className="text-slate-800">extra.js</strong> را از طریق{' '}
                    <strong className="text-slate-800">Elementor &gt; Custom Code</strong> (در انتهای{' '}
                    <code>&lt;body&gt;</code>) یا افزونه رایگان <strong>WPCode</strong> به برگه اضافه کنید تا{' '}
                    <code>IntersectionObserver</code>، رسم مدارها و پارالاکس فعال شوند.
                  </p>
                </li>
              </ol>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}
