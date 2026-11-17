// ===== IMPORTS & DEPENDENCIES =====
import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  Columns,
  Cpu,
  Layers,
  LayoutGrid,
} from 'lucide-react';
import { ElementorNode } from '../types/elementor';

// ===== TYPES & INTERFACES =====
interface ElementorTreeViewProps {
  nodes: ElementorNode[];
}

interface TreeNodeItemProps {
  node: ElementorNode;
  depth: number;
  selectedNodeId: string | null;
  onSelectNode: (node: ElementorNode) => void;
}

// ===== UTILITY FUNCTIONS =====

function getElementLabelPersian(node: ElementorNode): string {
  if (node.elType === 'section') {
    return node.isInner ? 'سکشن داخلی (Inner Section)' : 'سکشن اصلی (Section)';
  }
  if (node.elType === 'column') {
    const size = node.settings._column_size ?? 100;
    return `ستون (Column — ${size}%)`;
  }
  if (node.elType === 'container') {
    return node.isInner
      ? 'کانتینر فرزند (Inner Container)'
      : 'کانتینر اصلی (Flexbox Container)';
  }
  if (node.elType === 'widget') {
    return `ویجت (${node.widgetType || 'unknown'})`;
  }
  return node.elType;
}

function getWidgetSummaryText(node: ElementorNode): string {
  if (node.elType !== 'widget') return '';
  const s = node.settings;
  if (typeof s.title === 'string' && s.title) return s.title.slice(0, 45);
  if (typeof s.text === 'string' && s.text) return s.text.slice(0, 45);
  if (typeof s.title_text === 'string' && s.title_text)
    return s.title_text.slice(0, 45);
  if (typeof s.editor === 'string' && s.editor) {
    return s.editor.replace(/<[^>]+>/g, '').slice(0, 45);
  }
  if (
    s.image &&
    typeof s.image === 'object' &&
    'url' in s.image &&
    typeof (s.image as { url: string }).url === 'string'
  ) {
    return (s.image as { url: string }).url.slice(0, 45);
  }
  return '';
}

// ===== CORE BUSINESS LOGIC =====

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  depth,
  selectedNodeId,
  onSelectNode,
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = Array.isArray(node.elements) && node.elements.length > 0;
  const isSelected = selectedNodeId === node.id;
  const summary = getWidgetSummaryText(node);

  const renderIcon = () => {
    if (node.elType === 'section') {
      return <Layers className="w-4 h-4 text-indigo-600 shrink-0" />;
    }
    if (node.elType === 'column') {
      return <Columns className="w-4 h-4 text-sky-600 shrink-0" />;
    }
    if (node.elType === 'container') {
      return <LayoutGrid className="w-4 h-4 text-teal-600 shrink-0" />;
    }
    return <Cpu className="w-4 h-4 text-emerald-600 shrink-0" />;
  };

  return (
    <div className="select-none">
      <div
        onClick={() => onSelectNode(node)}
        style={{ paddingRight: `${depth * 20 + 12}px` }}
        className={`flex items-center justify-between py-2 pl-3 border-b border-slate-100 cursor-pointer transition-colors text-xs ${
          isSelected
            ? 'bg-indigo-50/80 text-slate-900 font-medium'
            : 'hover:bg-slate-50 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
              aria-label={expanded ? 'بستن زیرمجموعه' : 'باز کردن زیرمجموعه'}
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4 inline-block shrink-0" />
          )}

          {renderIcon()}

          <span className="truncate">{getElementLabelPersian(node)}</span>

          {summary && (
            <>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-500 truncate max-w-[220px]">
                {summary}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
          <span>elType: {node.elType}</span>
          <span aria-hidden="true">·</span>
          <span>id: #{node.id}</span>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.elements.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ElementorTreeView: React.FC<ElementorTreeViewProps> = ({
  nodes,
}) => {
  const [selectedNode, setSelectedNode] = useState<ElementorNode | null>(
    nodes[0] || null
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 border border-slate-200 rounded-xl bg-white overflow-hidden">
      {/* Right Column: Interactive Tree Hierarchy */}
      <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-l border-slate-200 flex flex-col max-h-[540px]">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">
            ساختار سلسله‌مراتبی گره‌های Elementor
          </span>
          <span className="text-xs text-slate-500 tabular-nums">
            برای مشاهده تنظیمات رسمی هر المان روی آن کلیک کنید
          </span>
        </div>
        <div className="overflow-y-auto divide-y divide-slate-100">
          {nodes.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              selectedNodeId={selectedNode?.id || null}
              onSelectNode={setSelectedNode}
            />
          ))}
        </div>
      </div>

      {/* Left Column: Selected Node Settings Inspector */}
      <div className="lg:col-span-5 flex flex-col max-h-[540px] bg-slate-900 text-slate-100">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">
            بازرس تنظیمات المان انتخاب‌شده (settings)
          </span>
          {selectedNode && (
            <span className="text-xs font-mono text-indigo-400 tabular-nums">
              #{selectedNode.id}
            </span>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs leading-relaxed" dir="ltr">
          {selectedNode ? (
            <pre className="whitespace-pre-wrap break-words text-slate-200">
              {JSON.stringify(
                {
                  id: selectedNode.id,
                  elType: selectedNode.elType,
                  ...(selectedNode.widgetType
                    ? { widgetType: selectedNode.widgetType }
                    : {}),
                  ...(selectedNode.isInner !== undefined
                    ? { isInner: selectedNode.isInner }
                    : {}),
                  settings: selectedNode.settings,
                  childrenCount: selectedNode.elements.length,
                },
                null,
                2
              )}
            </pre>
          ) : (
            <p className="text-slate-400 text-right" dir="rtl">
              یک گره از درخت سمت راست انتخاب کنید تا کلیدهای رسمی Elementor آن نمایش داده شود.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
