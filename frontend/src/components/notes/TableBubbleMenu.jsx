"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Palette,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignVerticalJustifyStart,
    AlignVerticalJustifyCenter,
    AlignVerticalJustifyEnd,
    Eraser,
    Grid3X3,
    Grip,
} from "lucide-react";

export function TableBubbleMenu({ editor }) {
    const [show, setShow] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [tableRect, setTableRect] = useState(null);
    const [colHandles, setColHandles] = useState([]);
    const [rowHandles, setRowHandles] = useState([]);
    const [resizeHandles, setResizeHandles] = useState([]);
    const [dragging, setDragging] = useState(null);
    const [dragOver, setDragOver] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const [resizing, setResizing] = useState(null);
    const [hoveredResize, setHoveredResize] = useState(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const moveColumn = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;

        editor.chain().focus().command(({ tr, state, dispatch }) => {
            const { selection } = state;
            const nodeAtPos = editor.view.domAtPos(selection.from).node;
            const table = nodeAtPos.closest?.("table") || nodeAtPos.parentElement?.closest("table");
            if (!table) return false;

            const tablePos = editor.view.posAtDOM(table, 0);
            const tableNode = state.doc.nodeAt(tablePos);
            if (!tableNode || tableNode.type.name !== 'table') return false;

            const rows = [];
            tableNode.forEach((row) => rows.push(row));

            const newRows = rows.map(row => {
                const cells = [];
                row.forEach(cell => cells.push(cell));

                const [movedCell] = cells.splice(fromIndex, 1);
                cells.splice(toIndex, 0, movedCell);

                return row.type.create(row.attrs, cells);
            });

            if (dispatch) {
                tr.replaceWith(tablePos + 1, tablePos + tableNode.nodeSize - 1, newRows);
                return true;
            }
            return false;
        }).run();
    };

    const moveRow = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;

        editor.chain().focus().command(({ tr, state, dispatch }) => {
            const { selection } = state;
            const nodeAtPos = editor.view.domAtPos(selection.from).node;
            const table = nodeAtPos.closest?.("table") || nodeAtPos.parentElement?.closest("table");
            if (!table) return false;

            const tablePos = editor.view.posAtDOM(table, 0);
            const tableNode = state.doc.nodeAt(tablePos);
            if (!tableNode || tableNode.type.name !== 'table') return false;

            const rows = [];
            tableNode.forEach(row => rows.push(row));

            const [movedRow] = rows.splice(fromIndex, 1);
            rows.splice(toIndex, 0, movedRow);

            if (dispatch) {
                tr.replaceWith(tablePos + 1, tablePos + tableNode.nodeSize - 1, rows);
                return true;
            }
            return false;
        }).run();
    };

    const onDragStart = (e, type, index) => {
        setDragging({ type, index });
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';

        const ghost = document.createElement('div');
        ghost.style.opacity = '0';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const onDragOver = (e, index) => {
        e.preventDefault();
        setDragOver(index);
    };

    const onDrop = (e, targetIndex) => {
        e.preventDefault();
        if (dragging) {
            if (dragging.type === 'col') {
                moveColumn(dragging.index, targetIndex);
            } else {
                moveRow(dragging.index, targetIndex);
            }
        }
        setDragging(null);
        setDragOver(null);
    };

    const setColumnWidth = (colIndex, width) => {
        editor.chain().focus().command(({ tr, state, dispatch }) => {
            const { selection } = state;
            const nodeAtPos = editor.view.domAtPos(selection.from).node;
            const tableElement = nodeAtPos.closest?.("table") || nodeAtPos.parentElement?.closest("table");
            if (!tableElement) return false;

            const tablePos = editor.view.posAtDOM(tableElement, 0);
            const tableNode = state.doc.nodeAt(tablePos);
            if (!tableNode || tableNode.type.name !== 'table') return false;

            const rows = [];
            tableNode.forEach((row) => rows.push(row));

            const newRows = rows.map(row => {
                const cells = [];
                row.forEach((cell, cellIndex) => {
                    if (cellIndex === colIndex) {
                        const currentStyle = cell.attrs.style || '';
                        const styleWithoutWidth = currentStyle.replace(/width:\s*[^;]+;?/g, '').trim();
                        const updatedStyle = styleWithoutWidth 
                            ? `${styleWithoutWidth}; width: ${width}px`
                            : `width: ${width}px`;
                        
                        cells.push(cell.type.create({
                            ...cell.attrs,
                            style: updatedStyle.trim()
                        }, cell.content));
                    } else {
                        cells.push(cell);
                    }
                });
                return row.type.create(row.attrs, cells);
            });

            if (dispatch) {
                tr.replaceWith(tablePos + 1, tablePos + tableNode.nodeSize - 1, newRows);
                return true;
            }
            return false;
        }).run();
    };

    const onResizeStart = (e, colIndex) => {
        console.log('Resize start triggered', { colIndex, event: e.type });
        e.preventDefault();
        e.stopPropagation();
        
        const startX = e.clientX;
        const table = document.querySelector('.ProseMirror table');
        if (!table) {
            console.log('No table found');
            return;
        }
        
        const cells = table.querySelectorAll('tr:first-child > td, tr:first-child > th');
        const cell = cells[colIndex];
        if (!cell) {
            console.log('No cell found for index', colIndex);
            return;
        }
        
        const startWidth = cell.getBoundingClientRect().width;
        console.log('Starting resize', { colIndex, startWidth });
        
        const resizeState = { type: 'col', index: colIndex, startX, startWidth };
        setResizing(resizeState);

        const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - resizeState.startX;
            const newWidth = Math.max(50, resizeState.startWidth + deltaX);
            
            // Apply width directly to DOM for immediate visual feedback
            const currentCells = table.querySelectorAll(`tr > td:nth-child(${colIndex + 1}), tr > th:nth-child(${colIndex + 1})`);
            currentCells.forEach(cell => {
                cell.style.width = `${newWidth}px`;
            });
        };

        const handleMouseUp = () => {
            // Persist the final width to editor state
            const cells = table.querySelectorAll('tr:first-child > td, tr:first-child > th');
            const finalCell = cells[colIndex];
            if (finalCell) {
                const finalWidth = finalCell.getBoundingClientRect().width;
                setColumnWidth(colIndex, finalWidth);
            }
            
            setResizing(null);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    useEffect(() => {
        if (!editor) return;

        const updateMenu = () => {
            const isTable = editor.isActive("table");
            setShow(isTable);

            if (isTable) {
                const { view } = editor;
                const { from } = editor.state.selection;
                try {
                    const nodeAtPos = view.domAtPos(from).node;
                    const table = nodeAtPos.closest?.("table") || nodeAtPos.parentElement?.closest("table");

                    if (table) {
                        const tRect = table.getBoundingClientRect();
                        setTableRect(tRect);

                        const firstRow = table.querySelector("tr");
                        if (firstRow) {
                            const cells = firstRow.querySelectorAll("td, th");
                            const handles = Array.from(cells).map((cell, index) => {
                                const cRect = cell.getBoundingClientRect();
                                return {
                                    id: `col-${index}`,
                                    left: cRect.left + cRect.width / 2,
                                    top: tRect.top - 20,
                                    index,
                                    width: cRect.width,
                                    height: cRect.height
                                };
                            });
                            setColHandles(handles);

                            // Create resize handles for column borders
                            const resizeHandlesArray = [];
                            Array.from(cells).forEach((cell, index) => {
                                const cRect = cell.getBoundingClientRect();
                                resizeHandlesArray.push({
                                    id: `resize-${index}`,
                                    left: cRect.right,
                                    top: tRect.top,
                                    height: tRect.height,
                                    colIndex: index
                                });
                            });
                            setResizeHandles(resizeHandlesArray);
                        }

                        const rows = table.querySelectorAll("tr");
                        const rHandles = Array.from(rows).map((row, index) => {
                            const rRect = row.getBoundingClientRect();
                            return {
                                id: `row-${index}`,
                                left: tRect.left - 20,
                                top: rRect.top + rRect.height / 2,
                                index,
                                width: rRect.width,
                                height: rRect.height
                            };
                        });
                        setRowHandles(rHandles);

                        const selectionPos = view.coordsAtPos(editor.state.selection.to);
                        setMenuPos({
                            top: selectionPos.bottom - 12,
                            left: selectionPos.right - 12
                        });
                    }
                } catch (e) {
                    // Silent fail
                }
            }
        };

        editor.on("selectionUpdate", updateMenu);
        editor.on("transaction", updateMenu);
        window.addEventListener("resize", updateMenu);

        return () => {
            editor.off("selectionUpdate", updateMenu);
            editor.off("transaction", updateMenu);
            window.removeEventListener("resize", updateMenu);
        };
    }, [editor]);

    if (!editor || !show || !mounted || !tableRect) {
        return null;
    }

    const textColors = [
        { name: "Green text", value: "#15803d" },
        { name: "Blue text", value: "#1d4ed8" },
        { name: "Purple text", value: "#7e22ce" },
        { name: "Pink text", value: "#be185d" },
        { name: "Red text", value: "#b91c1c" },
        { name: "Default text", value: "inherit" },
    ];

    const bgColors = [
        { name: "Gray background", value: "#f3f4f6" },
        { name: "Brown background", value: "#fef3c7" },
        { name: "Orange background", value: "#ffedd5" },
        { name: "Default background", value: "transparent" },
    ];

    const menuContent = (
        <>
            {/* Column Resize Handles */}
            {resizeHandles.map((handle) => {
                const isActive = resizing?.index === handle.colIndex || hoveredResize === handle.colIndex;
                return (
                    <div
                        key={handle.id}
                        data-resize-handle={handle.colIndex}
                        className="fixed z-[60] cursor-col-resize"
                        style={{
                            top: `${handle.top}px`,
                            left: `${handle.left - 6}px`,
                            width: '12px',
                            height: `${handle.height}px`,
                            pointerEvents: 'auto',
                            backgroundColor: isActive ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.05)'
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Resize handle clicked', handle.colIndex);
                            onResizeStart(e, handle.colIndex);
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Resize handle clicked via click', handle.colIndex);
                            onResizeStart(e, handle.colIndex);
                        }}
                        onMouseEnter={() => setHoveredResize(handle.colIndex)}
                        onMouseLeave={() => setHoveredResize(null)}
                    >
                        <div 
                            className="absolute left-1/2 -translate-x-1/2 w-[3px] h-full bg-purple-500 rounded-full transition-opacity"
                            style={{
                                opacity: isActive ? '1' : '0.7'
                            }}
                        />
                    </div>
                );
            })}

            {/* Column Handles */}
            {colHandles.map((handle) => (
                <div
                    key={handle.id}
                    className={`fixed z-50 -translate-x-1/2 transition-all ${dragging?.type === 'col' && dragOver === handle.index ? 'bg-indigo-100 scale-110' : ''}`}
                    style={{ top: `${handle.top}px`, left: `${handle.left}px` }}
                    draggable="true"
                    onDragStart={(e) => onDragStart(e, 'col', handle.index)}
                    onDragOver={(e) => onDragOver(e, handle.index)}
                    onDrop={(e) => onDrop(e, handle.index)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="table-handle w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold cursor-grab active:cursor-grabbing shadow-sm border border-slate-200 bg-white hover:bg-slate-50">
                                <span className="mb-1">...</span>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-40">
                            <DropdownMenuItem onClick={() => editor.commands.selectColumn()}>Select column</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>Add column before</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column after</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive font-medium" onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ))}

            {/* Row Handles */}
            {rowHandles.map((handle) => (
                <div
                    key={handle.id}
                    className={`fixed z-50 -translate-y-1/2 transition-all ${dragging?.type === 'row' && dragOver === handle.index ? 'bg-indigo-100 scale-110' : ''}`}
                    style={{ top: `${handle.top}px`, left: `${handle.left}px` }}
                    draggable="true"
                    onDragStart={(e) => onDragStart(e, 'row', handle.index)}
                    onDragOver={(e) => onDragOver(e, handle.index)}
                    onDrop={(e) => onDrop(e, handle.index)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="table-handle w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-bold cursor-grab active:cursor-grabbing shadow-sm border border-slate-200 bg-white hover:bg-slate-50">
                                ⋮
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-40">
                            <DropdownMenuItem onClick={() => editor.commands.selectRow()}>Select row</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>Add row before</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>Add row after</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive font-medium" onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ))}

            {/* Drag Indicators */}
            {dragging && dragOver !== null && (
                <div
                    className="fixed z-40 bg-indigo-500/30 border-2 border-indigo-500 pointer-events-none transition-all duration-100"
                    style={dragging.type === 'col' ? {
                        top: `${tableRect.top}px`,
                        height: `${tableRect.height}px`,
                        left: `${colHandles[dragOver].left - colHandles[dragOver].width / 2}px`,
                        width: `${colHandles[dragOver].width}px`
                    } : {
                        left: `${tableRect.left}px`,
                        width: `${tableRect.width}px`,
                        top: `${rowHandles[dragOver].top - rowHandles[dragOver].height / 2}px`,
                        height: `${rowHandles[dragOver].height}px`
                    }}
                />
            )}

            {/* Context Menu Button */}
            <div
                className="fixed z-50 transition-all duration-75"
                style={{
                    top: `${menuPos.top}px`,
                    left: `${menuPos.left}px`,
                }}
            >
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="default"
                            size="icon"
                            className="h-6 w-6 bg-indigo-600 rounded-full shadow-lg hover:bg-indigo-700 p-1"
                        >
                            <Grip className="h-3 w-3 text-white" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1.5 z-[100]">
                        {editor.can().mergeCells() && (
                            <>
                                <DropdownMenuItem onClick={() => editor.chain().focus().mergeCells().run()}>
                                    <Grid3X3 className="h-4 w-4 mr-2" />
                                    Merge cells
                                </DropdownMenuItem>
                                <div className="h-px bg-border my-1" />
                            </>
                        )}
                        {editor.can().splitCell() && (
                            <>
                                <DropdownMenuItem onClick={() => editor.chain().focus().splitCell().run()}>
                                    <Grid3X3 className="h-4 w-4 mr-2" />
                                    Split cell
                                </DropdownMenuItem>
                                <div className="h-px bg-border my-1" />
                            </>
                        )}

                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Palette className="h-4 w-4 mr-2" />
                                Color
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56 p-2">
                                <div className="p-1">
                                    {textColors.map((color) => (
                                        <DropdownMenuItem
                                            key={color.value}
                                            className="flex items-center gap-2"
                                            onClick={() => {
                                                if (color.value === 'inherit') {
                                                    editor.chain().focus().unsetColor().run();
                                                } else {
                                                    editor.chain().focus().setColor(color.value).run();
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-center w-5 h-5 rounded-sm border bg-muted">
                                                <span style={{ color: color.value === 'inherit' ? 'currentColor' : color.value }} className="font-bold text-xs">A</span>
                                            </div>
                                            <span className="text-sm">{color.name}</span>
                                        </DropdownMenuItem>
                                    ))}
                                </div>

                                <Separator className="my-2" />

                                <div className="px-1 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Background Color
                                </div>
                                <div className="p-1">
                                    {bgColors.map((color) => (
                                        <DropdownMenuItem
                                            key={color.value}
                                            className="flex items-center gap-2"
                                            onClick={() => {
                                                editor
                                                    .chain()
                                                    .focus()
                                                    .updateAttributes("tableCell", { style: `background-color: ${color.value}` })
                                                    .updateAttributes("tableHeader", { style: `background-color: ${color.value}` })
                                                    .run();
                                            }}
                                        >
                                            <div
                                                className="w-5 h-5 rounded-full border border-slate-200"
                                                style={{ backgroundColor: color.value }}
                                            />
                                            <span className="text-sm">{color.name}</span>
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <AlignCenter className="h-4 w-4 mr-2" />
                                Alignment
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuItem
                                    onClick={() => {
                                        editor
                                            .chain()
                                            .focus()
                                            .updateAttributes("tableCell", { style: "text-align: left" })
                                            .updateAttributes("tableHeader", { style: "text-align: left" })
                                            .run();
                                    }}
                                >
                                    <AlignLeft className="h-4 w-4 mr-2" />
                                    Align left
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        editor
                                            .chain()
                                            .focus()
                                            .updateAttributes("tableCell", { style: "text-align: center" })
                                            .updateAttributes("tableHeader", { style: "text-align: center" })
                                            .run();
                                    }}
                                >
                                    <AlignCenter className="h-4 w-4 mr-2" />
                                    Align center
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        editor
                                            .chain()
                                            .focus()
                                            .updateAttributes("tableCell", { style: "text-align: right" })
                                            .updateAttributes("tableHeader", { style: "text-align: right" })
                                            .run();
                                    }}
                                >
                                    <AlignRight className="h-4 w-4 mr-2" />
                                    Align right
                                </DropdownMenuItem>
                                <div className="h-px bg-border my-1" />
                                <DropdownMenuItem
                                    onClick={() => {
                                        editor
                                            .chain()
                                            .focus()
                                            .updateAttributes("tableCell", { style: "vertical-align: top" })
                                            .updateAttributes("tableHeader", { style: "vertical-align: top" })
                                            .run();
                                    }}
                                >
                                    <AlignVerticalJustifyStart className="h-4 w-4 mr-2" />
                                    Align top
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        editor
                                            .chain()
                                            .focus()
                                            .updateAttributes("tableCell", { style: "vertical-align: middle" })
                                            .updateAttributes("tableHeader", { style: "vertical-align: middle" })
                                            .run();
                                    }}
                                >
                                    <AlignVerticalJustifyCenter className="h-4 w-4 mr-2" />
                                    Align middle
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        editor
                                            .chain()
                                            .focus()
                                            .updateAttributes("tableCell", { style: "vertical-align: bottom" })
                                            .updateAttributes("tableHeader", { style: "vertical-align: bottom" })
                                            .run();
                                    }}
                                >
                                    <AlignVerticalJustifyEnd className="h-4 w-4 mr-2" />
                                    Align bottom
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuItem
                            onClick={() => {
                                editor.chain().focus().command(({ tr, state, dispatch }) => {
                                    const { selection } = state;
                                    const positions = [];

                                    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
                                        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                                            positions.push({ pos, size: node.nodeSize });
                                        }
                                    });

                                    if (positions.length > 0 && dispatch) {
                                        positions.sort((a, b) => b.pos - a.pos).forEach(({ pos, size }) => {
                                            tr.delete(pos + 1, pos + size - 1);
                                        });
                                        return true;
                                    }
                                }).run();
                            }}
                        >
                            <Eraser className="h-4 w-4 mr-2" />
                            {editor.can().mergeCells() ? "Clear column contents" : "Clear contents"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </>
    );

    return createPortal(menuContent, document.body);
}