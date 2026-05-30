import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { PluginKey } from "prosemirror-state";
import tippy from "tippy.js";
import SuggestionList from "./SuggestionList";

export const Emoji = Extension.create({
    name: "emoji",

    addOptions() {
        return {
            suggestion: {
                char: ":",
                command: ({ editor, range, props }) => {
                    props.command({ editor, range });
                },
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                pluginKey: new PluginKey("emoji"),
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});

export const emojiSuggestionItems = ({ query }) => {
    const emojis = [
        { label: "😀", title: "Smile", name: "smile" },
        { label: "😂", title: "Laugh", name: "laugh" },
        { label: "❤️", title: "Heart", name: "heart" },
        { label: "🔥", title: "Fire", name: "fire" },
        { label: "✅", title: "Check", name: "check" },
        { label: "🚀", title: "Rocket", name: "rocket" },
        { label: "💡", title: "Idea", name: "idea" },
        { label: "✨", title: "Sparkles", name: "sparkles" },
        { label: "👍", title: "Thumb Up", name: "thumbup" },
        { label: "🙏", title: "Pray", name: "pray" },
    ];

    return emojis
        .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
        .map(item => ({
            ...item, command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).insertContent(item.label).run();
            }
        }));
};
