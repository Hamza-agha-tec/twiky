"use client";

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Highlight from "@tiptap/extension-highlight"
import Superscript from "@tiptap/extension-superscript"
import Subscript from "@tiptap/extension-subscript"
import TextAlign from "@tiptap/extension-text-align"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Image from "@tiptap/extension-image"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import Heading from "@tiptap/extension-heading"
import BulletList from "@tiptap/extension-bullet-list"
import OrderedList from "@tiptap/extension-ordered-list"
import ListItem from "@tiptap/extension-list-item"
import Blockquote from "@tiptap/extension-blockquote"
import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import Typography from "@tiptap/extension-typography"
import {
  Undo,
  Redo,
  RotateCcw,
  RotateCw,
  Bold,
  Italic,
  Strikethrough,
  Code,
  UnderlineIcon,
  Link2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  SuperscriptIcon,
  SubscriptIcon,
  FileCode,
  CheckSquare,
  ImageIcon,
  Table as TableIcon,
  Quote,
  Minus,
  Code2,
  Type,
  Palette,
  Menu,
  PaintBucket,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import DragHandle from "@tiptap/extension-drag-handle-react";
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import SuggestionList from "./extensions/SuggestionList";
import { TableBubbleMenu } from './TableBubbleMenu';

// Custom Extensions
import { SlashCommand, renderItems, suggestionItems } from "./extensions/SlashCommand";
import { Emoji, emojiSuggestionItems } from "./extensions/Emoji";
import { ResizableImage } from "./extensions/ResizableImage";
import { channelsApi } from '@/lib/channels-api';

const HIGHLIGHT_COLORS = [
  null, // No color
  "#000000", "#475569", "#94a3b8", "#ef4444", "#fb923c", "#f59e0b",
  "#eab308", "#84cc16", "#22c55e", "#10b981", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
]

export function RichTextEditor({ initialContent, onChange, editable = true, channelId }) {
  const { user } = useAuth()
  const imageInputRef = useRef(null)
  const channelIdRef = useRef(channelId)

  useEffect(() => {
    channelIdRef.current = channelId
  }, [channelId])

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      TextStyle,
      Color,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 dark:text-indigo-400 underline decoration-indigo-500/30 underline-offset-4'
        }
      }),
      Highlight.configure({ multicolor: true }),
      Superscript,
      Subscript,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      ResizableImage.configure({
        inline: true,
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: element => element.getAttribute('style'),
              renderHTML: attributes => {
                if (!attributes.style) return {}
                return { style: attributes.style }
              },
            },
            colspan: {
              default: 1,
              parseHTML: element => parseInt(element.getAttribute('colspan') || '1', 10),
              renderHTML: attributes => {
                if (attributes.colspan === 1) return {}
                return { colspan: attributes.colspan }
              },
            },
            rowspan: {
              default: 1,
              parseHTML: element => parseInt(element.getAttribute('rowspan') || '1', 10),
              renderHTML: attributes => {
                if (attributes.rowspan === 1) return {}
                return { rowspan: attributes.rowspan }
              },
            },
          }
        },
      }),
      TableCell.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: element => element.getAttribute('style'),
              renderHTML: attributes => {
                if (!attributes.style) return {}
                return { style: attributes.style }
              },
            },
            colspan: {
              default: 1,
              parseHTML: element => parseInt(element.getAttribute('colspan') || '1', 10),
              renderHTML: attributes => {
                if (attributes.colspan === 1) return {}
                return { colspan: attributes.colspan }
              },
            },
            rowspan: {
              default: 1,
              parseHTML: element => parseInt(element.getAttribute('rowspan') || '1', 10),
              renderHTML: attributes => {
                if (attributes.rowspan === 1) return {}
                return { rowspan: attributes.rowspan }
              },
            },
          }
        },
      }),
      Typography,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          char: '@',
          items: async ({ query }) => {
            const currentChannelId = channelIdRef.current;
            if (!currentChannelId || currentChannelId === 'personal') return [];

            try {
              const members = await channelsApi.getMembers(currentChannelId);

              return (members || [])
                .filter(m => m.user?.id !== user?.id) // Filter out the current user
                .map(m => {
                  const tag = m.user?.username || `user_${m.user?.id?.substring(0, 4)}`;
                  return { tag, userId: m.user?.id };
                })
                .filter(item => item.tag && item.tag.toLowerCase().includes(query.toLowerCase()))
                .map(item => ({
                  label: item.tag,
                  id: item.tag,
                  command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).setMention({ id: item.tag, label: item.tag }).run();

                    // Notifications would go here
                  }
                }));
            } catch (e) {
              console.error('Mention error:', e);
              return [];
            }
          },
          render: () => {
            let component;
            let popup;

            return {
              onStart: (props) => {
                if (!props.clientRect) return;

                component = new ReactRenderer(SuggestionList, {
                  props,
                  editor: props.editor,
                });

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate(props) {
                component?.updateProps(props);

                if (props.clientRect) {
                  popup?.[0]?.setProps({
                    getReferenceClientRect: props.clientRect,
                  });
                }
              },

              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown(props);
              },

              onExit() {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
      SlashCommand.configure({
        suggestion: {
          items: suggestionItems,
          render: renderItems,
        },
      }),
      Emoji.configure({
        suggestion: {
          items: emojiSuggestionItems,
          render: renderItems,
        },
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "prose prose-slate dark:prose-invert prose-sm sm:prose focus:outline-none min-h-full max-w-none px-4",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent)
    }
  }, [editor, initialContent])

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  if (!editor) {
    return null
  }

  const setLink = () => {
    const url = window.prompt("Enter URL:")
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const addImage = () => {
    imageInputRef.current?.click()
  }

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const src = e.target?.result
        if (src) {
          editor.chain().focus().setImage({ src }).run()
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const getHeadingLevel = () => {
    if (editor.isActive("heading", { level: 1 })) return "1"
    if (editor.isActive("heading", { level: 2 })) return "2"
    if (editor.isActive("heading", { level: 3 })) return "3"
    return "paragraph"
  }

  const setHeading = (level) => {
    editor
      .chain()
      .focus()
      .toggleHeading({ level: Number.parseInt(level) })
      .run()
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      <input ref={imageInputRef} type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />

      {editable && (
        <div className="flex-none border dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl mb-6 p-1 flex items-center gap-0.5 z-10 overflow-x-auto shadow-sm no-scrollbar"
          style={{ flexWrap: 'nowrap' }}
        >
          {/* Group 1: History */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6 bg-slate-100 dark:bg-slate-800" />

          {/* Group 2: Basic Formatting */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleBold().run()}
              data-active={editor.isActive("bold")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500 font-bold"
            >
              <span className="text-sm">B</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              data-active={editor.isActive("italic")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500 italic"
            >
              <span className="text-sm">I</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              data-active={editor.isActive("underline")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500 underline"
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              data-active={editor.isActive("strike")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500 line-through"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleCode().run()}
              data-active={editor.isActive("code")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500"
            >
              <Code className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6 bg-slate-100 dark:bg-slate-800" />

          {/* Group 3: Color & Highlight */}
          <div className="flex items-center gap-0.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-slate-500"
                  data-active={editor.isActive("textStyle") && editor.getAttributes("textStyle").color}
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-2 border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl" align="start">
                <div className="grid grid-cols-7 gap-1.5 p-1">
                  {HIGHLIGHT_COLORS.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (color) {
                          editor.chain().focus().setColor(color).run()
                        } else {
                          editor.chain().focus().unsetColor().run()
                        }
                      }}
                      className={cn(
                        "w-7 h-7 rounded-lg border border-slate-200/50 dark:border-slate-800 transition-all hover:scale-110 active:scale-95 flex items-center justify-center overflow-hidden",
                        !color && "bg-slate-50 dark:bg-slate-900"
                      )}
                      style={color ? { backgroundColor: color } : {}}
                    >
                      {!color && <span className="text-[10px] text-slate-400">Ø</span>}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-slate-500"
                  data-active={editor.isActive("highlight")}
                >
                  <PaintBucket className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-2 border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl" align="start">
                <div className="grid grid-cols-7 gap-1.5 p-1">
                  {HIGHLIGHT_COLORS.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (color) {
                          editor.chain().focus().setHighlight({ color }).run()
                        } else {
                          editor.chain().focus().unsetHighlight().run()
                        }
                      }}
                      className={cn(
                        "w-7 h-7 rounded-lg border border-slate-200/50 dark:border-slate-800 transition-all hover:scale-110 active:scale-95 flex items-center justify-center overflow-hidden",
                        !color && "bg-slate-50 dark:bg-slate-900"
                      )}
                      style={color ? { backgroundColor: color } : {}}
                    >
                      {!color && <span className="text-[10px] text-slate-400">Ø</span>}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6 bg-slate-100 dark:bg-slate-800" />

          {/* Group 4: Headings */}
          <div className="flex items-center gap-1 px-1">
            <Button
              variant="ghost"
              onClick={() => setHeading("1")}
              data-active={editor.isActive("heading", { level: 1 })}
              className="h-8 px-2 rounded-lg text-xs font-bold transition-all data-[active=true]:bg-amber-100/60 data-[active=true]:text-amber-600 dark:data-[active=true]:bg-amber-900/30 dark:data-[active=true]:text-amber-400 text-slate-500"
            >
              H1
            </Button>
            <Button
              variant="ghost"
              onClick={() => setHeading("2")}
              data-active={editor.isActive("heading", { level: 2 })}
              className="h-8 px-2 rounded-lg text-xs font-bold transition-all data-[active=true]:bg-amber-100/60 data-[active=true]:text-amber-600 dark:data-[active=true]:bg-amber-900/30 dark:data-[active=true]:text-amber-400 text-slate-500"
            >
              H2
            </Button>
            <Button
              variant="ghost"
              onClick={() => setHeading("3")}
              data-active={editor.isActive("heading", { level: 3 })}
              className="h-8 px-2 rounded-lg text-xs font-bold transition-all data-[active=true]:bg-amber-100/60 data-[active=true]:text-amber-600 dark:data-[active=true]:bg-amber-900/30 dark:data-[active=true]:text-amber-400 text-slate-500"
            >
              H3
            </Button>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6 bg-slate-100 dark:bg-slate-800" />

          {/* Group 5: Lists */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              data-active={editor.isActive("bulletList")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              data-active={editor.isActive("orderedList")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              data-active={editor.isActive("taskList")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500"
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6 bg-slate-100 dark:bg-slate-800" />

          {/* Group 6: Advanced Formatting */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              data-active={editor.isActive("blockquote")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500"
            >
              <Quote className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              data-active={editor.isActive("codeBlock")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-500"
            >
              <Code2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6 bg-slate-100 dark:bg-slate-800" />

          {/* Group 7: Assets */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={addImage}
              className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6 bg-slate-100 dark:bg-slate-800" />

          {/* Group 8: Alignments */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              data-active={editor.isActive({ textAlign: "left" })}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-400"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              data-active={editor.isActive({ textAlign: "center" })}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-400"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              data-active={editor.isActive({ textAlign: "right" })}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-400"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
          <Separator orientation="vertical" className="mx-1 h-6 bg-slate-100 dark:bg-slate-800" />
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-400">
              <Menu className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6 bg-slate-100 dark:bg-slate-800" />
            <Button
              variant="ghost"
              size="icon"
              onClick={setLink}
              data-active={editor.isActive("link")}
              className="h-8 w-8 rounded-xl data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800 text-slate-400"
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().unsetLink().run()}
              disabled={!editor.isActive("link")}
              className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30"
            >
              <div className="relative">
                <Link2 className="h-4 w-4" />
                <div className="absolute top-0 right-0 h-px w-full bg-red-400 rotate-45" />
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* {editable && (
        <div className="flex-none border dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl mb-6 p-1 flex items-center gap-0.5 z-10 overflow-x-auto shadow-sm no-scrollbar w-fit"
          style={{ flexWrap: 'nowrap' }}
        >
          
        </div>
      )} */}

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <TableBubbleMenu editor={editor} />

        <DragHandle editor={editor}>
          <div className="p-1 rounded bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm cursor-grab hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          </div>
        </DragHandle>
        <EditorContent editor={editor} className="h-full focus:outline-none" />
      </div>

      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror {
          padding-bottom: 100px;
        }
        .ProseMirror h1 {
          font-size: 1.875rem; /* 30px */
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          font-weight: 800;
          line-height: 1.2;
        }
        .ProseMirror h2 {
          font-size: 1.5rem; /* 24px */
          margin-top: 1.25rem;
          margin-bottom: 0.75rem;
          font-weight: 700;
          line-height: 1.3;
        }
        .ProseMirror h3 {
          font-size: 1.25rem; /* 20px */
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
          line-height: 1.4;
        }
        .ProseMirror ul, 
        .ProseMirror ol {
          padding-left: 1.25rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror li {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
        .ProseMirror li p {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        .mention {
          background-color: rgba(99, 102, 241, 0.1);
          color: #6366f1;
          border-radius: 4px;
          padding: 0 4px;
          font-weight: 600;
          text-decoration: none;
        }
        .dark .mention {
          background-color: rgba(129, 140, 248, 0.2);
          color: #818cf8;
        }
      `}</style>
    </div>
  )
}

