"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";

// ─── Excalidraw (SSR-safe) ────────────────────────────────────────────────────

type ExcalidrawProps = {
  initialData?: { elements?: unknown[]; appState?: Record<string, unknown>; files?: Record<string, unknown> };
  onChange?: (elements: readonly unknown[], appState: Record<string, unknown>, files: Record<string, unknown>) => void;
  viewModeEnabled?: boolean;
  zenModeEnabled?: boolean;
  theme?: "light" | "dark";
  UIOptions?: Record<string, unknown>;
};

const ExcalidrawEmbed = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#1e1e2e] text-xs text-zinc-500">
        Loading canvas…
      </div>
    ),
  }
) as React.ComponentType<Record<string, unknown>>;

// ─── Types ────────────────────────────────────────────────────────────────────

export type Slide = {
  id: string;
  title: string;
  content: string;
  code_content?: string;
  type?: "text" | "whiteboard" | "code";
  board_data?: string;
};
export type CourseData = { v: 2; slides: Slide[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

export function serializeCourse(slides: Slide[]): string {
  return JSON.stringify({ v: 2, slides } satisfies CourseData);
}

export function deserializeCourse(raw: string): Slide[] {
  if (!raw?.trim()) return [{ id: uid(), title: "Page 1", content: "" }];
  try {
    const p = JSON.parse(raw);
    if (p?.v === 2 && Array.isArray(p.slides) && p.slides.length > 0) return p.slides;
  } catch { /* fall through */ }
  // Legacy plain string — migrate as single page
  return [{ id: uid(), title: "Page 1", content: raw }];
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

export function renderCourseMarkdown(md: string): string {
  let html = md
    // Escape HTML, then selectively re-allow safe tags
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Callout blocks (must run before line-level processing)
    .replace(/:::danger\n([\s\S]*?):::/g, '<div class="callout callout-danger">$1</div>')
    .replace(/:::warning\n([\s\S]*?):::/g, '<div class="callout callout-warning">$1</div>')
    .replace(/:::tip\n([\s\S]*?):::/g, '<div class="callout callout-tip">$1</div>')
    .replace(/:::info\n([\s\S]*?):::/g, '<div class="callout callout-info">$1</div>')
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Inline formatting
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\+\+(.+?)\+\+/g, "<u>$1</u>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/==(.+?)==/g, "<mark>$1</mark>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    // Blockquote
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    // Divider
    .replace(/^---$/gm, "<hr />")
    // Arrow bullets
    .replace(/^-&gt; (.+)$/gm, "<li class='arrow-li'>$1</li>")
    // Regular lists
    .replace(/^- (.+)$/gm, "<li class='ul'>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li class='ol'>$1</li>")
    // Media
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[video\]\(([^)]+)\)/g, (_: string, url: string) => {
      const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      return yt
        ? `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen></iframe></div>`
        : `<a href="${url}" target="_blank" rel="noopener">[Video link]</a>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");
  return `<div class="cb-preview"><p>${html}</p></div>`;
}

const PREVIEW_STYLES = `
  .cb-preview h1{font-size:1.3rem;font-weight:700;color:#f4f4f5;margin:1.25rem 0 .5rem}
  .cb-preview h2{font-size:1.1rem;font-weight:700;color:#e4e4e7;margin:1rem 0 .4rem}
  .cb-preview h3{font-size:.95rem;font-weight:600;color:#d4d4d8;margin:.75rem 0 .3rem}
  .cb-preview p{color:#a1a1aa;font-size:.875rem;line-height:1.75;margin:.5rem 0}
  .cb-preview strong{color:#f4f4f5;font-weight:600}
  .cb-preview em{color:#d4d4d8;font-style:italic}
  .cb-preview u{text-decoration:underline;color:#e4e4e7}
  .cb-preview del{text-decoration:line-through;color:#71717a}
  .cb-preview mark{background:rgba(250,204,21,.22);color:#fde68a;border-radius:2px;padding:0 2px}
  .cb-preview code{background:rgba(255,255,255,.08);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:.8rem;color:#67e8f9}
  .cb-preview hr{border:none;border-top:1px solid rgba(255,255,255,.1);margin:1rem 0}
  .cb-preview blockquote{border-left:3px solid var(--accent-color);padding:.5rem 1rem;margin:.75rem 0;background:rgba(255,255,255,.03);border-radius:0 .5rem .5rem 0;color:#a1a1aa}
  .cb-preview li{color:#a1a1aa;font-size:.875rem;margin-bottom:.25rem}
  .cb-preview li.ul{list-style:disc;margin-left:1.25rem}
  .cb-preview li.ol{list-style:decimal;margin-left:1.25rem}
  .cb-preview li.arrow-li{list-style:none;padding-left:1.5rem;position:relative}
  .cb-preview li.arrow-li::before{content:"→";position:absolute;left:0;color:var(--accent-color)}
  .cb-preview img{max-width:100%;border-radius:.75rem;border:1px solid rgba(255,255,255,.1);margin:.5rem 0}
  .cb-preview a{color:var(--accent-color);text-decoration:underline}
  .cb-preview .video-wrap{position:relative;padding-top:56.25%;margin:.75rem 0;border-radius:.75rem;overflow:hidden}
  .cb-preview .video-wrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
  .cb-preview .callout{border-radius:.75rem;padding:.75rem 1rem;margin:.75rem 0;font-size:.875rem;line-height:1.6}
  .cb-preview .callout-info{background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.25);color:#93c5fd}
  .cb-preview .callout-tip{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:#86efac}
  .cb-preview .callout-warning{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);color:#fcd34d}
  .cb-preview .callout-danger{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#fca5a5}
`;

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

function TB({ title, onClick, active, children }: { title: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`flex h-7 min-w-[28px] items-center justify-center rounded px-1 text-xs font-medium transition ${active ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]" : "text-zinc-400 hover:bg-white/10 hover:text-zinc-200"}`}>
      {children}
    </button>
  );
}
function Sep() { return <span className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />; }

// ─── Rich Editor V2 ───────────────────────────────────────────────────────────

export function RichEditorV2({ value, onChange, placeholder, minHeight = 280, simple = false }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** simple=true removes inline code, code block, callout, and video embed (for short description fields) */
  simple?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [vidUrl, setVidUrl] = useState("");
  const [showImg, setShowImg] = useState(false);
  const [showVid, setShowVid] = useState(false);
  const [showCallout, setShowCallout] = useState(false);
  const [showHL, setShowHL] = useState(false);

  function wrap(before: string, after = "") {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = value.slice(s, e) || "text";
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); });
  }

  function prefix(p: string) {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart;
    const ls = value.lastIndexOf("\n", s - 1) + 1;
    onChange(value.slice(0, ls) + p + value.slice(ls));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + p.length, s + p.length); });
  }

  function block(txt: string) {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart;
    const nl = s > 0 && value[s - 1] !== "\n" ? "\n" : "";
    onChange(value.slice(0, s) + nl + txt + "\n" + value.slice(s));
    requestAnimationFrame(() => { const p = s + nl.length + txt.length + 1; ta.focus(); ta.setSelectionRange(p, p); });
  }

  const callouts = [
    { t: "info",    label: "Info",    cls: "text-blue-400 bg-blue-400/10" },
    { t: "tip",     label: "Tip",     cls: "text-green-400 bg-green-400/10" },
    { t: "warning", label: "Warning", cls: "text-amber-400 bg-amber-400/10" },
    { t: "danger",  label: "Danger",  cls: "text-red-400 bg-red-400/10" },
  ];
  const highlights = [
    { mark: "==", label: "Yellow", cls: "bg-yellow-400/25 text-yellow-200" },
    { mark: "==", label: "Cyan",   cls: "bg-cyan-400/25 text-cyan-200" },
    { mark: "==", label: "Green",  cls: "bg-green-400/25 text-green-200" },
    { mark: "==", label: "Red",    cls: "bg-red-400/25 text-red-200" },
  ];

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--app-card-alt)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-white/10 bg-white/[0.02] px-2 py-1.5">
        <TB title="Bold" onClick={() => wrap("**", "**")}><b>B</b></TB>
        <TB title="Italic" onClick={() => wrap("*", "*")}><i>I</i></TB>
        <TB title="Underline (++text++)" onClick={() => wrap("++", "++")}><u>U</u></TB>
        <TB title="Strikethrough" onClick={() => wrap("~~", "~~")}><s>S</s></TB>
        <Sep />
        <TB title="Heading 1" onClick={() => prefix("# ")}><span className="text-[10px] font-bold">H1</span></TB>
        <TB title="Heading 2" onClick={() => prefix("## ")}><span className="text-[10px] font-bold">H2</span></TB>
        <TB title="Heading 3" onClick={() => prefix("### ")}><span className="text-[10px] font-bold">H3</span></TB>
        <Sep />
        <TB title="Bullet list" onClick={() => prefix("- ")}>
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        </TB>
        <TB title="Numbered list" onClick={() => prefix("1. ")}>
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h13M7 12h13M7 16h13M3 8h.01M3 12h.01M3 16h.01" /></svg>
        </TB>
        <TB title="Arrow bullet (-> text)" onClick={() => prefix("-> ")}><span>→</span></TB>
        <TB title="Blockquote" onClick={() => prefix("> ")}><span className="text-base leading-none">"</span></TB>
        <Sep />
        {!simple && <TB title="Inline code" onClick={() => wrap("`", "`")}><span className="font-mono text-[11px]">{"`c`"}</span></TB>}
        {!simple && (
          <TB title="Code block" onClick={() => block("```\ncode here\n```")}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </TB>
        )}
        <TB title="Divider" onClick={() => block("---")}>
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" /></svg>
        </TB>
        <Sep />

        {/* Highlight dropdown */}
        <div className="relative">
          <TB title="Highlight text" onClick={() => { setShowHL((v) => !v); setShowCallout(false); }}>
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </TB>
          {showHL && (
            <div className="absolute left-0 top-full z-30 mt-1 rounded-lg border border-white/10 bg-[var(--app-bg)] p-2 shadow-xl">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">Highlight</p>
              <div className="flex gap-1">
                {highlights.map((h) => (
                  <button key={h.label} type="button"
                    onClick={() => { wrap("==", "=="); setShowHL(false); }}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${h.cls}`}>{h.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Callout dropdown */}
        {!simple && <div className="relative">
          <TB title="Callout box" onClick={() => { setShowCallout((v) => !v); setShowHL(false); }}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </TB>
          {showCallout && (
            <div className="absolute left-0 top-full z-30 mt-1 min-w-[130px] rounded-lg border border-white/10 bg-[var(--app-bg)] p-2 shadow-xl">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">Callout box</p>
              {callouts.map((c) => (
                <button key={c.t} type="button"
                  onClick={() => { block(`:::${c.t}\nYour ${c.label.toLowerCase()} here\n:::`); setShowCallout(false); }}
                  className={`mb-0.5 w-full rounded px-2 py-1 text-left text-[11px] font-medium ${c.cls}`}>{c.label}</button>
              ))}
            </div>
          )}
        </div>}

        <Sep />

        {/* Image */}
        <TB title="Insert image" active={showImg} onClick={() => { setShowImg((v) => !v); setShowVid(false); }}>
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </TB>
        {/* Video */}
        {!simple && (
          <TB title="Embed YouTube video" active={showVid} onClick={() => { setShowVid((v) => !v); setShowImg(false); }}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </TB>
        )}

        {/* Preview toggle */}
        <button type="button" onClick={() => setPreview((v) => !v)}
          className={`ml-auto rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${preview ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)]" : "text-zinc-500 hover:text-zinc-300"}`}>
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Image URL row */}
      {showImg && (
        <div className="flex gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-2">
          <input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="Image URL…"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-100 outline-none focus:border-[var(--accent-color)]/40" />
          <button type="button" onClick={() => { if (imgUrl.trim()) { wrap(`![image](${imgUrl.trim()})`); setImgUrl(""); setShowImg(false); } }}
            className="rounded-lg bg-[var(--accent-color)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20">Insert</button>
        </div>
      )}

      {/* Video URL row */}
      {!simple && showVid && (
        <div className="flex gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-2">
          <input value={vidUrl} onChange={(e) => setVidUrl(e.target.value)} placeholder="YouTube URL…"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-100 outline-none focus:border-[var(--accent-color)]/40" />
          <button type="button" onClick={() => { if (vidUrl.trim()) { wrap(`[video](${vidUrl.trim()})`); setVidUrl(""); setShowVid(false); } }}
            className="rounded-lg bg-[var(--accent-color)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20">Embed</button>
        </div>
      )}

      {/* Content */}
      {preview ? (
        <>
          <div className="cb-preview min-h-[var(--mh)] overflow-y-auto px-4 py-3"
            style={{ "--mh": `${minHeight}px` } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: renderCourseMarkdown(value) }} />
          <style>{PREVIEW_STYLES}</style>
        </>
      ) : (
        <textarea ref={taRef} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Write your content…"}
          className="resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder-zinc-600"
          style={{ minHeight }} />
      )}

      {/* Footer hint */}
      <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-zinc-600">
        **bold** · *italic* · ++underline++ · ~~strike~~ · ==highlight== · {">"} quote · {"-> "} arrow · :::info / tip / warning / danger:::
      </div>
    </div>
  );
}

// ─── Whiteboard Slide ────────────────────────────────────────────────────────

const SAFE_APPSTATE = { viewBackgroundColor: "#1e1e2e", collaborators: new Map() };

function parseBoard(raw?: string): { elements: unknown[]; appState: Record<string, unknown> } {
  if (!raw) return { elements: [], appState: { ...SAFE_APPSTATE } };
  try {
    const p = JSON.parse(raw);
    const appState = JSON.parse(
      JSON.stringify(p.appState ?? {}, (_k, v) => {
        if (v instanceof Map || v instanceof Set) return undefined;
        if (typeof v === "function") return undefined;
        return v;
      })
    ) as Record<string, unknown>;
    // collaborators must always be a Map — Excalidraw calls .forEach() on it
    delete appState.collaborators;
    return { elements: Array.isArray(p.elements) ? p.elements : [], appState: { ...SAFE_APPSTATE, ...appState } };
  } catch {
    return { elements: [], appState: { ...SAFE_APPSTATE } };
  }
}

function WhiteboardSlide({ boardData, onChange, readOnly, height = 400 }: {
  boardData?: string;
  onChange?: (data: string) => void;
  readOnly?: boolean;
  height?: number;
}) {
  // Only use boardData on first mount — Excalidraw owns the state after that
  const initialData = useMemo(() => parseBoard(boardData), []); // eslint-disable-line react-hooks/exhaustive-deps
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Cancel any pending save when the component unmounts (e.g. switching slide type)
  // without this, the stale callback fires ~600ms later and reverts the type change
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function handleChange(elements: readonly unknown[], appState: Record<string, unknown>, files: Record<string, unknown>) {
    if (!onChangeRef.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onChangeRef.current?.(JSON.stringify({ elements, appState, files }));
    }, 600);
  }

  const props: Record<string, unknown> = {
    initialData,
    theme: "dark",
    viewModeEnabled: readOnly ?? false,
    zenModeEnabled: readOnly ?? false,
  };
  if (!readOnly) props.onChange = handleChange;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10" style={{ height }}>
      <ExcalidrawEmbed {...props} />
    </div>
  );
}

// ─── Slide thumbnail ──────────────────────────────────────────────────────────

function SlidePill({ slide, index, active, onClick, onDelete, onUp, onDown, isFirst, isLast }: {
  slide: Slide; index: number; active: boolean;
  onClick: () => void; onDelete: () => void; onUp: () => void; onDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  return (
    <div onClick={onClick}
      className={`group relative cursor-pointer rounded-xl border p-2.5 transition ${active ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/8" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
      {/* Index + actions */}
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className={`text-[10px] font-bold tabular-nums ${active ? "text-[var(--accent-color)]" : "text-zinc-600"}`}>{index + 1}</span>
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          {!isFirst && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onUp(); }}
              className="rounded p-0.5 text-zinc-600 hover:text-zinc-300" title="Move up">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
            </button>
          )}
          {!isLast && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onDown(); }}
              className="rounded p-0.5 text-zinc-600 hover:text-zinc-300" title="Move down">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            </button>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded p-0.5 text-zinc-600 hover:text-red-400" title="Delete page">
            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {slide.type === "whiteboard" ? (
          <svg className="h-2.5 w-2.5 shrink-0 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        ) : slide.type === "code" ? (
          <svg className="h-2.5 w-2.5 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        ) : null}
        <p className={`truncate text-[11px] font-medium ${active ? "text-zinc-200" : "text-zinc-400"}`}>
          {slide.title || "Untitled"}
        </p>
      </div>
      {slide.type === "whiteboard" ? (
        <p className="mt-0.5 text-[9px] text-purple-500">Whiteboard canvas</p>
      ) : slide.type === "code" ? (
        <p className="mt-0.5 text-[9px] text-cyan-600">Code block</p>
      ) : slide.content ? (
        <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-zinc-600">
          {slide.content.replace(/[#*`~>+=-]/g, "").slice(0, 70)}
        </p>
      ) : null}
    </div>
  );
}

// ─── Course Builder (editor) ──────────────────────────────────────────────────

export function CourseBuilder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [slides, setSlides] = useState<Slide[]>(() => deserializeCourse(value));
  const [activeIdx, setActiveIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const sync = useCallback((next: Slide[]) => {
    setSlides(next);
    onChange(serializeCourse(next));
  }, [onChange]);

  function addSlide() {
    const next = [...slides, { id: uid(), title: `Page ${slides.length + 1}`, content: "" }];
    sync(next);
    setActiveIdx(next.length - 1);
  }

  function deleteSlide(i: number) {
    if (slides.length <= 1) return;
    const next = slides.filter((_, j) => j !== i);
    sync(next);
    setActiveIdx(Math.min(activeIdx, next.length - 1));
  }

  function move(i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= slides.length) return;
    const next = [...slides];
    [next[i], next[t]] = [next[t], next[i]];
    sync(next);
    setActiveIdx(t);
  }

  function update(i: number, patch: Partial<Slide>) {
    sync(slides.map((s, j) => j === i ? { ...s, ...patch } : s));
  }

  const active = slides[activeIdx] ?? slides[0];

  const inner = (
    <div className={`flex gap-3 ${fullscreen ? "h-full" : ""}`}>
      {/* Slide sidebar */}
      <div className="flex w-40 shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Pages</p>
          <span className="text-[10px] text-zinc-600">{slides.length}</span>
        </div>
        <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: 460 }}>
          {slides.map((s, i) => (
            <SlidePill key={s.id} slide={s} index={i} active={i === activeIdx}
              onClick={() => setActiveIdx(i)}
              onDelete={() => deleteSlide(i)}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              isFirst={i === 0} isLast={i === slides.length - 1}
            />
          ))}
        </div>
        <button type="button" onClick={addSlide}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 py-2 text-[11px] font-medium text-zinc-500 transition hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)]">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Page
        </button>
      </div>

      {/* Editor */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {/* Title + page type toggle */}
        <div className="flex items-center gap-2">
          <input value={active?.title ?? ""} onChange={(e) => update(activeIdx, { title: e.target.value })}
            placeholder="Page title…"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 outline-none placeholder-zinc-600 focus:border-[var(--accent-color)]/40" />
          {/* Page type toggle */}
          <div className="flex shrink-0 overflow-hidden rounded-xl border border-white/10">

            <button type="button"
              onClick={() => update(activeIdx, { type: "text" })}
              title="Text / rich content page"
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition ${(!active?.type || active.type === "text") ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)]" : "text-zinc-500 hover:text-zinc-300"}`}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Text
            </button>
            <button type="button"
              onClick={() => update(activeIdx, { type: "whiteboard" })}
              title="Whiteboard / drawing canvas"
              className={`flex items-center gap-1.5 border-l border-white/10 px-3 py-2 text-xs font-medium transition ${active?.type === "whiteboard" ? "bg-purple-500/15 text-purple-400" : "text-zinc-500 hover:text-zinc-300"}`}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Whiteboard
            </button>
            <button type="button"
              onClick={() => update(activeIdx, { type: "code" })}
              title="Code block"
              className={`flex items-center gap-1.5 border-l border-white/10 px-3 py-2 text-xs font-medium transition ${active?.type === "code" ? "bg-cyan-500/15 text-cyan-400" : "text-zinc-500 hover:text-zinc-300"}`}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              Code
            </button>
          </div>
          {/* Fullscreen toggle */}
          <button type="button" onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen editor"}
            className="shrink-0 rounded-xl border border-white/10 p-2 text-zinc-500 transition hover:border-white/20 hover:text-[var(--accent-color)]">
            {fullscreen ? (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v5m0-5h5M15 9l5-5m0 0v5m0-5h-5M9 15l-5 5m0 0v-5m0 5h5M15 15l5 5m0 0v-5m0 5h-5" /></svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            )}
          </button>
        </div>

        {/* Page content — text, code, or whiteboard */}
        {(!active?.type || active.type === "text") ? (
          <RichEditorV2
            value={active?.content ?? ""}
            onChange={(v) => update(activeIdx, { content: v })}
            placeholder="Write this page's content…"
            minHeight={fullscreen ? 600 : 340}
          />
        ) : active.type === "code" ? (
          <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--app-card-alt)]">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-3 py-2">
              <span className="text-[10px] font-medium text-cyan-400">Code block</span>
              <span className="text-[10px] text-zinc-600">Pine Script, Python, indicators, strategies…</span>
            </div>
            <textarea
              value={active?.code_content ?? ""}
              onChange={(e) => update(activeIdx, { code_content: e.target.value })}
              placeholder="Paste your code here…"
              className="resize-none bg-transparent px-4 py-3 font-mono text-xs leading-relaxed text-zinc-300 outline-none placeholder-zinc-600"
              style={{ minHeight: fullscreen ? 600 : 340 }}
              spellCheck={false}
            />
          </div>
        ) : (
          <div className={fullscreen ? "flex-1" : ""}>
            <WhiteboardSlide
              key={active.id} // remount when switching slides
              boardData={active.board_data}
              onChange={(data) => update(activeIdx, { board_data: data })}
              height={fullscreen ? undefined : 420}
            />
            <p className="mt-1.5 text-[10px] text-zinc-600">
              Full Excalidraw canvas — draw, annotate, add shapes, arrows, and images. Auto-saved as you work.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--app-bg)" }}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="text-xs font-semibold text-zinc-400">Course Builder — Fullscreen</span>
          <button type="button" onClick={() => setFullscreen(false)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-200">
            <svg className="inline h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v5m0-5h5M15 9l5-5m0 0v5m0-5h-5M9 15l-5 5m0 0v-5m0 5h5M15 15l5 5m0 0v-5m0 5h-5" /></svg>
            Exit Fullscreen
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">{inner}</div>
      </div>
    );
  }

  return inner;
}

// ─── Copy helper ──────────────────────────────────────────────────────────────

function copyText(text: string, onSuccess?: () => void) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => onSuccess?.()).catch(() => fallbackCopy(text, onSuccess));
  } else {
    fallbackCopy(text, onSuccess);
  }
}

function fallbackCopy(text: string, onSuccess?: () => void) {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(el);
  el.select();
  try { document.execCommand("copy"); onSuccess?.(); } catch { /* */ }
  document.body.removeChild(el);
}

function CodeSlide({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    copyText(code, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <div className="relative px-4 py-3">
      <button
        type="button"
        onClick={copy}
        className="absolute right-6 top-5 rounded border border-white/10 px-2 py-0.5 text-[10px] text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[var(--app-card-alt)] px-4 py-3 pr-20 font-mono text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
        {code || <span className="text-zinc-600 italic">No code</span>}
      </pre>
    </div>
  );
}

// ─── Slide Viewer (purchased content) ────────────────────────────────────────

export function SlideViewer({ content, username, noWatermark, fullscreen }: { content: string; username: string; noWatermark?: boolean; fullscreen?: boolean }) {
  const slides = deserializeCourse(content);
  const [page, setPage] = useState(0);
  const isSingle = slides.length === 1;
  const slide = slides[page] ?? slides[0];
  const label = username || "licensed";
  const wm = Array.from({ length: 10 });

  return (
    <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
      {/* Page header */}
      {!isSingle && (
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2">
          <p className="text-xs font-semibold text-zinc-300">{slide.title}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">{page + 1} / {slides.length}</span>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="rounded p-1 text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setPage((p) => Math.min(slides.length - 1, p + 1))} disabled={page === slides.length - 1}
              className="rounded p-1 text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Page navigation dots */}
      {slides.length > 1 && (
        <div className="flex gap-1 justify-center border-b border-white/[0.05] px-4 py-1.5 overflow-x-auto">
          {slides.map((s, i) => (
            <button key={s.id} onClick={() => setPage(i)}
              title={s.title}
              className={`shrink-0 rounded-full transition ${i === page ? "h-1.5 w-6 bg-[var(--accent-color)]" : "h-1.5 w-1.5 bg-white/20 hover:bg-white/40"}`} />
          ))}
        </div>
      )}

      {/* Content */}
      {slide.type === "whiteboard" ? (
        <WhiteboardSlide
          key={slide.id}
          boardData={slide.board_data}
          readOnly
          height={fullscreen ? Math.max(520, typeof window !== "undefined" ? window.innerHeight - 160 : 520) : 340}
        />
      ) : slide.type === "code" ? (
        <CodeSlide code={slide.code_content ?? slide.content} />
      ) : (
        <div className={`pointer-events-none px-4 py-3 cb-preview ${fullscreen ? "min-h-[60vh] text-base" : "min-h-[200px]"}`}
          dangerouslySetInnerHTML={{ __html: renderCourseMarkdown(slide.content) }} />
      )}

      {/* Watermark — hidden when noWatermark */}
      {!noWatermark && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 10 }}>
          {wm.map((_, ri) => (
            <div key={ri} className="flex gap-16"
              style={{ marginTop: ri === 0 ? "3rem" : "4.5rem", transform: "rotate(-25deg) translateX(-20%)" }}>
              {[0,1,2,3,4,5].map((ci) => (
                <span key={ci} className="whitespace-nowrap text-xs font-medium tracking-widest text-white/[0.055]"
                  style={{ userSelect: "none" }}>{label}</span>
              ))}
            </div>
          ))}
        </div>
      )}

      <style>{PREVIEW_STYLES}</style>
    </div>
  );
}
