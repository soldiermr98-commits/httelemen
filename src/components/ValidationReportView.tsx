// ===== IMPORTS & DEPENDENCIES =====
import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FileCode2,
  Layers,
  Scissors,
  Wrench,
  XCircle,
} from 'lucide-react';
import { ConversionReport } from '../types/elementor';

// ===== TYPES & INTERFACES =====
interface ValidationReportViewProps {
  report: ConversionReport;
}

// ===== CORE BUSINESS LOGIC =====

export const ValidationReportView: React.FC<ValidationReportViewProps> = ({
  report,
}) => {
  const errorCount = report.validationIssues.filter(
    (i) => i.severity === 'error'
  ).length;
  const warningCount = report.validationIssues.filter(
    (i) => i.severity === 'warning'
  ).length;
  const successCount = report.validationIssues.filter(
    (i) => i.severity === 'success'
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary Header Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          report.canDownload
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : 'bg-red-50/70 border-red-200 text-red-950'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold text-sm">
            {report.canDownload ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>
              {report.canDownload
                ? 'اعتبارسنجی حالت ترکیبی (page.json + extra.css + extra.js) با موفقیت تایید شد'
                : 'خطای بحرانی در اعتبارسنجی — دانلود فایل تا رفع مشکل غیرفعال است'}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            ساختار JSON بومی، کلاس‌های اصلی (_css_classes)، لایه‌های تزئینی، فایل استایل مکمل (extra.css) و اسکریپت‌های رفتاری (extra.js) آماده دانلود هستند.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium tabular-nums shrink-0">
          <span className="text-emerald-700">✅ {successCount} تایید</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="text-amber-700">⚠️ {warningCount} هشدار</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="text-red-700">❌ {errorCount} خطا</span>
        </div>
      </div>

      {/* Requirement 9: 3-Part Hybrid Mode Report (Native vs Extra CSS/JS vs Manual) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: What is Native in page.json */}
        <div className="border border-emerald-200 rounded-xl bg-emerald-50/30 overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
            <h3 className="text-xs font-bold text-emerald-950">
              ۱. چه چیزی بومی است (page.json)
            </h3>
          </div>
          <ul className="p-4 space-y-2 text-xs text-slate-700 leading-relaxed list-disc list-inside flex-1">
            {report.hybridBreakdown.nativeItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Column 2: What is added via extra.css & extra.js */}
        <div className="border border-indigo-200 rounded-xl bg-indigo-50/30 overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-700 shrink-0" />
            <h3 className="text-xs font-bold text-indigo-950">
              ۲. چه چیزی با extra.css / extra.js اضافه می‌شود
            </h3>
          </div>
          <div className="p-4 space-y-3 text-xs text-slate-700 leading-relaxed flex-1">
            <div>
              <div className="font-semibold text-indigo-900 mb-1">
                استایل‌های مکمل در extra.css ({report.counts.extractedCssRules} قانون):
              </div>
              {report.hybridBreakdown.extraCssItems.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside">
                  {report.hybridBreakdown.extraCssItems.map((cItem, idx) => (
                    <li key={idx}>{cItem}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">فاقد قوانین CSS مکمل</p>
              )}
            </div>
            <div className="border-t border-indigo-100 pt-2">
              <div className="font-semibold text-indigo-900 mb-1">
                رفتارهای تعاملی در extra.js ({report.counts.extractedJsBlocks} اسکریپت):
              </div>
              {report.hybridBreakdown.extraJsItems.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside">
                  {report.hybridBreakdown.extraJsItems.map((jItem, idx) => (
                    <li key={idx}>{jItem}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">فاقد اسکریپت رفتاری</p>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: What requires Manual Action */}
        <div className="border border-amber-200 rounded-xl bg-amber-50/30 overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-700 shrink-0" />
            <h3 className="text-xs font-bold text-amber-950">
              ۳. چه چیزی دستی انجام می‌شود
            </h3>
          </div>
          <ul className="p-4 space-y-2 text-xs text-slate-700 leading-relaxed list-disc list-inside flex-1">
            {report.hybridBreakdown.manualActionItems.map((mItem, idx) => (
              <li key={idx}>{mItem}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Requirement 1: Excluded Sections Report (<header>, <nav>, .rail, <footer>) */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-semibold text-slate-800">
              گزارش بخش‌های حذف‌شده از JSON صفحه (هدر، فوتر، ناوبری و .rail)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {report.excludedSections.length} مورد
          </span>
        </div>
        {report.excludedSections.length > 0 ? (
          <div className="divide-y divide-slate-100 text-xs">
            {report.excludedSections.map((ex, idx) => (
              <div
                key={idx}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <span className="font-mono font-semibold text-slate-900" dir="ltr">
                  {ex.identifier}
                </span>
                <span className="text-slate-600">{ex.reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-xs text-slate-500">
            هیچ بخشی حذف نشد (گزینه «شامل هدر/فوتر» فعال است).
          </div>
        )}
      </div>

      {/* 7-Rule Validation Checklist Table */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-800">
            نتایج چک‌لیست اجباری اعتبارسنجی (مرحله ۶)
          </h3>
          <span className="text-xs text-slate-500 tabular-nums">
            زمان کل پردازش: {report.pipelineTimingsMs.total} میلی‌ثانیه
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {report.validationIssues.map((issue) => (
            <div
              key={issue.id}
              className="px-4 py-3 flex items-start justify-between gap-4 hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="text-sm leading-none mt-0.5 shrink-0">
                  {issue.severity === 'success'
                    ? '✅'
                    : issue.severity === 'warning'
                    ? '⚠️'
                    : '❌'}
                </span>
                <div className="space-y-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900">
                    {issue.title}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {issue.message}
                  </p>
                  {issue.details && (
                    <pre className="mt-1.5 p-2 rounded bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto">
                      {issue.details}
                    </pre>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                قانون #{issue.ruleNumber}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown Grid: Widget Distribution & Custom Fonts (@font-face) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Native Widgets Breakdown */}
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h4 className="text-xs font-semibold text-slate-800">
              فراوانی ویجت‌های بومی تولیدشده در page.json
            </h4>
          </div>
          <div className="p-4">
            {Object.keys(report.widgetBreakdown).length > 0 ? (
              <div className="divide-y divide-slate-100">
                {Object.entries(report.widgetBreakdown).map(([wType, count]) => (
                  <div
                    key={wType}
                    className="py-2 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-slate-800">{wType}</span>
                    <span className="font-mono font-semibold text-indigo-600 tabular-nums">
                      {count} عدد
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">هیچ ویجتی ثبت نشده است.</p>
            )}
          </div>
        </div>

        {/* Detected Custom Fonts & @font-face Files */}
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-semibold text-slate-800">
              فونت‌های سفارشی و فایل‌های @font-face ({'{{FONT_URL}}'})
            </h4>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1.5">
                خانواده فونت‌های شناسایی‌شده در صفحه:
              </div>
              {report.fontsDetected.length > 0 ? (
                <div className="text-xs text-slate-800 font-mono font-semibold">
                  {report.fontsDetected.join(' · ')}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  فقط فونت‌های پیش‌فرض سیستمی شناسایی شدند.
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-medium text-slate-700 mb-1.5">
                فایل‌های فونت استخراج‌شده در extra.css (نیازمند آپلود و جایگزینی {'{{FONT_URL}}'}):
              </div>
              {report.hybridBreakdown.fontFaceFiles.length > 0 ? (
                <ul className="space-y-1 text-xs font-mono text-slate-700" dir="ltr">
                  {report.hybridBreakdown.fontFaceFiles.map((fName, idx) => (
                    <li key={idx}>• {'{{FONT_URL}}'}/{fName}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">
                  هیچ بلوک @font-face مستقلی در CSS یافت نشد.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Placeholders & Replaced Pro Widgets Table */}
      {(report.placeholders.length > 0 ||
        report.replacedWidgets.length > 0) && (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <h4 className="text-xs font-semibold text-slate-800">
              گزارش جایگزینی‌های هوشمند، SVGهای محتوایی و Placeholderها
            </h4>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {report.replacedWidgets.map((rw, idx) => (
              <div key={`rw-${idx}`} className="p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-medium text-slate-900">
                    {rw.originalElement} ➔ {rw.mappedTo}
                  </span>
                  <span className="text-amber-700">جایگزینی ویجت Pro</span>
                </div>
                <p className="text-slate-600">{rw.reason}</p>
              </div>
            ))}

            {report.placeholders.map((ph, idx) => (
              <div key={`ph-${idx}`} className="p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">
                    {ph.element}
                  </span>
                  <span className="font-mono text-slate-500 truncate max-w-[280px]" dir="ltr">
                    {ph.placeholderValue}
                  </span>
                </div>
                <p className="text-slate-600">{ph.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
