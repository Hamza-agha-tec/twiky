"use client";

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Highlight from "@tiptap/extension-highlight"
import TextAlign from "@tiptap/extension-text-align"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Placeholder from "@tiptap/extension-placeholder"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import { forwardRef, useImperativeHandle, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import { channelsApi } from '@/lib/channels-api';
import SuggestionList from "@/components/notes/extensions/SuggestionList";
import { Emoji, emojiSuggestionItems } from "@/components/notes/extensions/Emoji";
import { SlashCommand, renderItems, suggestionItems } from "@/components/notes/extensions/SlashCommand";

export interface RichTextComposerHandle {
  focus: () => void
  clear: () => void
  insertEmoji: (emoji: string) => void
  getCaretOffset: () => number
  setCaretOffset: (offset: number) => void
  getHTML: () => string
  getText: () => string
}

interface RichTextComposerProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: ReactKeyboardEvent | KeyboardEvent) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  channelId?: string
}

type SuggestionProps = Record<string, unknown> & {
  clientRect?: (() => DOMRect) | null
  editor: unknown
}

type SuggestionKeyDownProps = {
  event: KeyboardEvent
}

type SuggestionListRef = {
  onKeyDown?: (props: SuggestionKeyDownProps) => boolean
}

export const RichTextComposer = forwardRef<RichTextComposerHandle, RichTextComposerProps>(({
  value, onChange, onKeyDown, placeholder, disabled, className, channelId
}, ref) => {
  const { user } = useAuth()
  const onKeyDownRef = useRef(onKeyDown)
  useEffect(() => { onKeyDownRef.current = onKeyDown }, [onKeyDown])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline decoration-primary/30 underline-offset-4'
        }
      }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: placeholder || "Type a message...",
      }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          char: '@',
          items: async ({ query }) => {
            if (!channelId || channelId === 'personal') return [];

            try {
              const members = await channelsApi.getMembers(channelId);

              return (members || [])
                .filter(m => m.user?.id !== user?.id)
                .map(m => {
                  const tag = m.user?.username || `user_${m.user?.id?.substring(0, 4)}`;
                  return { tag, userId: m.user?.id };
                })
                .filter(item => item.tag && item.tag.toLowerCase().includes(query.toLowerCase()))
                .map(item => ({
                  label: item.tag,
                  id: item.tag,
                  command: ({ editor, range }: { editor: any, range: any }) => {
                    editor.chain().focus().deleteRange(range).setMention({ id: item.tag, label: item.tag }).run();
                  }
                }));
            } catch (e) {
              console.error('Mention error:', e);
              return [];
            }
          },
          render: () => {
            let component: ReactRenderer<SuggestionListRef> | null = null
            let popup: any = null

            return {
              onStart: (props: any) => {
                if (!props.clientRect) return;

                component = new ReactRenderer<SuggestionListRef>(SuggestionList, {
                  props,
                  editor: props.editor as never,
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

              onUpdate(props: any) {
                component?.updateProps(props);

                if (props.clientRect) {
                  popup?.[0]?.setProps({
                    getReferenceClientRect: props.clientRect,
                  });
                }
              },

              onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown?.(props) ?? false;
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
    content: value,
    editorProps: {
      attributes: {
        class: cn("focus:outline-none prose prose-sm dark:prose-invert max-w-none", className),
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          onKeyDownRef.current?.(event)
          return true
        }
        onKeyDownRef.current?.(event)
        return false
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  }, [channelId, placeholder, user?.id])

  useImperativeHandle(ref, () => ({
    focus: () => { editor?.commands.focus() },
    clear: () => { editor?.commands.clearContent() },
    insertEmoji: (emoji: string) => {
      editor?.chain().focus().insertContent(emoji).run()
    },
    getCaretOffset: () => editor?.state.selection.from ?? 0,
    setCaretOffset: (offset: number) => {
      editor?.commands.setTextSelection(offset)
    },
    getHTML: () => editor?.getHTML() || "",
    getText: () => editor?.getText() || "",
  }))

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value || ""
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [value, editor])

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled)
    }
  }, [editor, disabled])

  if (!editor) return null

  return (
    <div className="relative w-full">
      <EditorContent editor={editor} />
      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
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
})

RichTextComposer.displayName = 'RichTextComposer'
