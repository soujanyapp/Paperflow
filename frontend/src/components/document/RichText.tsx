import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Link2, Highlighter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RichTextProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  minHeight?: number;
}

export function RichText({ value, onChange, placeholder = "Start writing…", className, autoFocus, onBlur, minHeight = 40 }: RichTextProps) {
  const [focused, setFocused] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Highlight,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "<p></p>",
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: { class: "pf-richtext outline-none", style: `min-height:${minHeight}px` },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      onBlur?.();
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    if (value !== editor.getHTML()) editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className={cn("relative", className)}>
      {focused ? <RichTextToolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function RichTextToolbar({ editor }: { editor: Editor }) {
  const buttons: Array<{ icon: React.ReactNode; action: () => void; active?: boolean; label: string }> = [
    { icon: <Bold className="size-3.5" />, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold"), label: "Bold" },
    { icon: <Italic className="size-3.5" />, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic"), label: "Italic" },
    { icon: <UnderlineIcon className="size-3.5" />, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive("underline"), label: "Underline" },
    { icon: <Strikethrough className="size-3.5" />, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike"), label: "Strikethrough" },
    { icon: <Highlighter className="size-3.5" />, action: () => editor.chain().focus().toggleHighlight().run(), active: editor.isActive("highlight"), label: "Highlight" },
    { icon: <List className="size-3.5" />, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList"), label: "Bulleted list" },
    { icon: <ListOrdered className="size-3.5" />, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList"), label: "Numbered list" },
  ];

  return (
    <div className="absolute -top-9 left-0 z-30 flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-md">
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          title={button.label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={button.action}
          className={cn(
            "grid size-6 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground",
            button.active && "bg-secondary text-foreground",
          )}
        >
          {button.icon}
        </button>
      ))}
      <button
        type="button"
        title="Add link"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", previous ?? "https://");
          if (url === null) return;
          if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
          else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
        className={cn(
          "grid size-6 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground",
          editor.isActive("link") && "bg-secondary text-foreground",
        )}
      >
        <Link2 className="size-3.5" />
      </button>
    </div>
  );
}
