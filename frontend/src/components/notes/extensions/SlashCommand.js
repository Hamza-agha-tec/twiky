import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { PluginKey } from "prosemirror-state";
import tippy from "tippy.js";
import {
    Heading1, Heading2, Heading3,
    List, ListOrdered, CheckSquare,
    Code, Table, ImageIcon,
    Quote
} from "lucide-react";
import SuggestionList from "./SuggestionList";

export const SlashCommand = Extension.create({
    name: "slashCommand",

    addOptions() {
        return {
            suggestion: {
                char: "/",
                command: ({ editor, range, props }) => {
                    props.command({ editor, range });
                },
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                pluginKey: new PluginKey("slashCommand"),
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});

export const renderItems = () => {
    let component = null;
    let popup = null;

    return {
        onStart: (props) => {
            component = new ReactRenderer(SuggestionList, {
                props,
                editor: props.editor,
            });

            if (!props.clientRect) {
                return;
            }

            popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
            });
        },

        onUpdate(props) {
            component?.updateProps(props);

            if (!props.clientRect) {
                return;
            }

            popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect,
            });
        },

        onKeyDown(props) {
            if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
            }

            return component?.ref?.onKeyDown(props);
        },

        onExit() {
            if (popup?.[0]) {
                popup[0].destroy();
            }
            if (component) {
                component.destroy();
            }
        },
    };
};

export const suggestionItems = ({ query }) => {
    return [
        {
            title: "Heading 1",
            icon: Heading1,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
            },
        },
        {
            title: "Heading 2",
            icon: Heading2,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
            },
        },
        {
            title: "Heading 3",
            icon: Heading3,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
            },
        },
        {
            title: "Bullet List",
            icon: List,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleBulletList().run();
            },
        },
        {
            title: "Numbered List",
            icon: ListOrdered,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleOrderedList().run();
            },
        },
        {
            title: "Task List",
            icon: CheckSquare,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleTaskList().run();
            },
        },
        {
            title: "Quote",
            icon: Quote,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleBlockquote().run();
            },
        },
        {
            title: "Code Block",
            icon: Code,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
            },
        },
        {
            title: "Table",
            icon: Table,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            },
        },
    ].filter((item) => item.title.toLowerCase().startsWith(query.toLowerCase()));
};
