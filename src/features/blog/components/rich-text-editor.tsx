"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold, Code, Heading2, Heading3, Heading4, Italic, Link2, List, ListOrdered, Minus, Quote, Redo, SquareCode, Strikethrough, Underline, Undo,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

type Mark = { icon: LucideIcon; label: string; active: (e: Editor) => boolean; run: (e: Editor) => void };

const GROUPS: Mark[][] = [
  [2, 3, 4].map((level) => ({
    icon: [Heading2, Heading3, Heading4][level - 2],
    label: `Heading ${level}`,
    active: (e) => e.isActive("heading", { level }),
    run: (e) => e.chain().focus().toggleHeading({ level: level as 2 | 3 | 4 }).run(),
  })),
  [
    { icon: Bold, label: "Bold", active: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
    { icon: Italic, label: "Italic", active: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
    { icon: Underline, label: "Underline", active: (e) => e.isActive("underline"), run: (e) => e.chain().focus().toggleUnderline().run() },
    { icon: Strikethrough, label: "Strikethrough", active: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
    { icon: Code, label: "Inline code", active: (e) => e.isActive("code"), run: (e) => e.chain().focus().toggleCode().run() },
  ],
  [
    { icon: List, label: "Bullet list", active: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, label: "Numbered list", active: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
    { icon: Quote, label: "Quote", active: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
    { icon: SquareCode, label: "Code block", active: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
  ],
];

// Readable defaults inside the editor only; the website styles the same tags its own way.
const CONTENT =
  "min-h-80 px-4 py-3 outline-none [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground " +
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold " +
  "[&_h4]:mt-4 [&_h4]:text-lg [&_h4]:font-semibold [&_hr]:my-6 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:rounded-lg [&_pre]:bg-muted " +
  "[&_pre]:p-3 [&_pre_code]:bg-transparent [&_ul]:list-disc [&_ul]:pl-6";

function LinkButton({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const active = useEditorState({ editor, selector: ({ editor }) => editor.isActive("link") });

  function apply() {
    const href = url.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href: /^(https?:|mailto:)/.test(href) ? href : `https://${href}` }).run();
    else chain.unsetLink().run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl(editor.getAttributes("link").href ?? "");
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Toggle size="sm" pressed={active} disabled={disabled} aria-label="Link">
          <Link2 />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="flex w-80 gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="https://… (empty removes the link)"
          aria-label="Link address"
        />
        <Button type="button" onClick={apply}>
          Apply
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      active: GROUPS.flat().map((m) => m.active(editor)),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });
  let i = 0;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-1">
      {GROUPS.map((group, g) => (
        <div key={g} className="flex items-center gap-1">
          {g > 0 && <Separator orientation="vertical" className="mx-1 h-5" />}
          {group.map((m) => {
            const pressed = state.active[i++];
            return (
              <Toggle key={m.label} size="sm" pressed={pressed} onPressedChange={() => m.run(editor)} disabled={disabled} aria-label={m.label} title={m.label}>
                <m.icon />
              </Toggle>
            );
          })}
        </div>
      ))}
      <Separator orientation="vertical" className="mx-1 h-5" />
      <LinkButton editor={editor} disabled={disabled} />
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={disabled} aria-label="Divider" title="Divider">
        <Minus />
      </Button>
      <div className="ml-auto flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.chain().focus().undo().run()} disabled={disabled || !state.canUndo} aria-label="Undo" title="Undo">
          <Undo />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.chain().focus().redo().run()} disabled={disabled || !state.canRedo} aria-label="Redo" title="Redo">
          <Redo />
        </Button>
      </div>
    </div>
  );
}

/** Rich-text field: posts its HTML with the surrounding form under `name` (cleaned again on the server). */
export function RichTextEditor({ id, name, defaultValue, disabled, invalid }: { id: string; name: string; defaultValue: string; disabled?: boolean; invalid?: boolean }) {
  const [html, setHtml] = useState(defaultValue);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true } })],
    content: defaultValue,
    editable: !disabled,
    // Rendered on the server first; Tiptap must wait for the browser.
    immediatelyRender: false,
    editorProps: { attributes: { id, class: CONTENT, "aria-label": "Post content", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => setHtml(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div className={cn("rounded-lg border bg-background", invalid && "border-destructive")}>
      {editor && <Toolbar editor={editor} disabled={disabled} />}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
