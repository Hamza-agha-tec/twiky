"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
    Heading1, Heading2, Heading3,
    List, ListOrdered, CheckSquare,
    Code, Table, ImageIcon,
    User, Search
} from "lucide-react";

const SuggestionList = forwardRef((props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    const upHandler = () => {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (event.key === "ArrowUp") {
                upHandler();
                return true;
            }
            if (event.key === "ArrowDown") {
                downHandler();
                return true;
            }
            if (event.key === "Enter") {
                enterHandler();
                return true;
            }
            return false;
        },
    }));

    if (props.items.length === 0) {
        return null;
    }

    return (
        <div className="z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md transition-all">
            {props.items.map((item, index) => (
                <button
                    key={index}
                    onClick={() => selectItem(index)}
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer ${index === selectedIndex ? "bg-accent text-accent-foreground" : ""
                        }`}
                >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    {item.title || item.label || item}
                </button>
            ))}
        </div>
    );
});

SuggestionList.displayName = "SuggestionList";

export default SuggestionList;
