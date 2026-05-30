import { Image } from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ResizableImageComponent from "./ResizableImageComponent";

export const ResizableImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: "100%",
                renderHTML: (attributes) => ({
                    style: `width: ${attributes.width}`,
                }),
            },
            alignment: {
                default: "center",
                renderHTML: (attributes) => ({
                    "data-alignment": attributes.alignment,
                }),
            },
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageComponent);
    },
});
