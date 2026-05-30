"use client";

import React, { useState, useRef, useEffect } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { AlignLeft, AlignCenter, AlignRight, Maximize } from "lucide-react";

const ResizableImage = (props) => {
    const { node, updateAttributes, selected } = props;
    const [resizing, setResizing] = useState(false);
    const [width, setWidth] = useState(node.attrs.width || "100%");
    const containerRef = useRef(null);

    const onResizeStart = (e) => {
        e.preventDefault();
        setResizing(true);
    };

    useEffect(() => {
        if (!resizing) return;

        const onResize = (e) => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const newWidth = e.clientX - rect.left;
                setWidth(`${newWidth}px`);
            }
        };

        const onResizeEnd = () => {
            setResizing(false);
            updateAttributes({ width });
        };

        window.addEventListener("mousemove", onResize);
        window.addEventListener("mouseup", onResizeEnd);

        return () => {
            window.removeEventListener("mousemove", onResize);
            window.removeEventListener("mouseup", onResizeEnd);
        };
    }, [resizing, width, updateAttributes]);

    const setAlignment = (alignment) => {
        updateAttributes({ alignment });
    };

    const alignmentClass = {
        left: "mr-auto ml-0",
        center: "mx-auto",
        right: "ml-auto mr-0",
        full: "w-full",
    }[node.attrs.alignment || "center"];

    return (
        <NodeViewWrapper className={`relative inline-block group ${alignmentClass}`} style={{ width: width === "100%" ? "100%" : width }}>
            <div
                ref={containerRef}
                className={`relative ${selected ? "ring-2 ring-indigo-500" : ""}`}
            >
                <img
                    src={node.attrs.src}
                    alt={node.attrs.alt}
                    className="w-full h-auto rounded-lg display-block"
                />

                {selected && (
                    <>
                        {/* Resize Handle */}
                        <div
                            onMouseDown={onResizeStart}
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-indigo-500 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        />

                        {/* Alignment Toolbar Overlay */}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background border rounded-lg p-1 shadow-lg z-20">
                            <button
                                onClick={() => setAlignment("left")}
                                className={`p-1.5 rounded-md hover:bg-accent ${node.attrs.alignment === "left" ? "bg-accent" : ""}`}
                            >
                                <AlignLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setAlignment("center")}
                                className={`p-1.5 rounded-md hover:bg-accent ${node.attrs.alignment === "center" || !node.attrs.alignment ? "bg-accent" : ""}`}
                            >
                                <AlignCenter className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setAlignment("right")}
                                className={`p-1.5 rounded-md hover:bg-accent ${node.attrs.alignment === "right" ? "bg-accent" : ""}`}
                            >
                                <AlignRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setAlignment("full")}
                                className={`p-1.5 rounded-md hover:bg-accent ${node.attrs.alignment === "full" ? "bg-accent" : ""}`}
                            >
                                <Maximize className="w-4 h-4" />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </NodeViewWrapper>
    );
};

export default ResizableImage;
