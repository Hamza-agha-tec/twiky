'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const DropdownMenu = ({ children }) => {
    const [open, setOpen] = React.useState(false);
    const containerRef = React.useRef(null);
    const [align, setAlign] = React.useState('right');

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Extract align prop from child content
    React.useEffect(() => {
        React.Children.forEach(children, child => {
            if (child.type === DropdownMenuContent && child.props.align) {
                setAlign(child.props.align);
            }
        });
    }, [children]);

    return (
        <div className="relative inline-block" ref={containerRef}>
            {React.Children.map(children, (child) => {
                if (child.type === DropdownMenuTrigger) {
                    return React.cloneElement(child, { onClick: () => setOpen(!open) });
                }
                if (child.type === DropdownMenuContent) {
                    return (
                        <AnimatePresence>
                            {open && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className={cn(
                                        'absolute mt-2 z-50 min-w-[12rem] rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900',
                                        align === 'end' ? 'right-0' : 'left-0',
                                        child.props.className
                                    )}
                                    onClick={(e) => {
                                        if (e.target.closest('[role="menuitem"]') && !e.target.closest('.submenu-trigger')) {
                                            setOpen(false);
                                        }
                                    }}
                                >
                                    {child.props.children}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    );
                }
                return child;
            })}
        </div>
    );
};

const DropdownMenuTrigger = ({ children, onClick, asChild }) => {
    if (asChild) {
        return React.cloneElement(children, { onClick });
    }
    return <button type="button" onClick={onClick}>{children}</button>;
};

const DropdownMenuContent = ({ children, className, align }) => <>{children}</>;

const DropdownMenuItem = ({ children, onClick, className, ...props }) => (
    <button
        type="button"
        role="menuitem"
        onClick={onClick}
        className={cn(
            'relative cursor-pointer flex w-full cursor-default select-none items-center rounded-md px-3 py-2.5 text-sm outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 text-slate-700 dark:text-slate-300',
            className
        )}
        {...props}
    >
        {children}
    </button>
);

const DropdownMenuSeparator = ({ className }) => (
    <div className={cn('-mx-1 my-1 h-px bg-slate-100 dark:bg-slate-800', className)} />
);

const DropdownMenuSub = ({ children }) => {
    const [open, setOpen] = React.useState(false);
    const [side, setSide] = React.useState('right');
    const [vAlign, setVAlign] = React.useState('top');
    const [maxHeight, setMaxHeight] = React.useState('70vh');
    const subRef = React.useRef(null);

    // Handle hover to open submenu
    const handleMouseEnter = (e) => {
        setOpen(true);
        if (subRef.current) {
            const rect = subRef.current.getBoundingClientRect();

            // Horizontal detection
            const spaceRight = window.innerWidth - rect.right;
            if (spaceRight < 200) {
                setSide('left');
            } else {
                setSide('right');
            }

            // Vertical detection & Max Height calculation
            const spaceBottom = window.innerHeight - rect.top - 10;
            const spaceTop = rect.bottom - 10;

            if (spaceBottom < 400 && spaceTop > spaceBottom) {
                setVAlign('bottom');
                setMaxHeight(`${Math.min(400, spaceTop)}px`);
            } else {
                setVAlign('top');
                setMaxHeight(`${Math.min(400, spaceBottom)}px`);
            }
        }
    };
    const handleMouseLeave = (e) => {
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && !subRef.current?.contains(relatedTarget)) {
            setOpen(false);
        }
    };

    return (
        <div
            className="relative"
            ref={subRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {React.Children.map(children, (child) => {
                if (child.type === DropdownMenuSubTrigger) {
                    return React.cloneElement(child, {
                        open,
                        onClick: (e) => {
                            e.stopPropagation();
                            setOpen(!open);
                        }
                    });
                }
                if (child.type === DropdownMenuSubContent) {
                    return open ? React.cloneElement(child, {
                        style: { maxHeight },
                        className: cn(
                            side === 'left' ? 'left-auto right-full mr-1' : 'left-full ml-1',
                            vAlign === 'bottom' ? 'top-auto bottom-0' : 'top-0',
                            child.props.className
                        ),
                        onMouseLeave: (e) => {
                            const relatedTarget = e.relatedTarget;
                            if (relatedTarget && !subRef.current?.contains(relatedTarget)) {
                                setOpen(false);
                            }
                        }
                    }) : null;
                }
                return child;
            })}
        </div>
    );
};

const DropdownMenuSubTrigger = ({ children, className, open, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            'submenu-trigger relative cursor-pointer flex w-full cursor-default select-none items-center rounded-md px-3 py-2.5 text-sm outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
            className
        )}
    >
        {children}
        <svg className="ml-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
    </div>
);

const DropdownMenuSubContent = ({ children, className, onMouseLeave, style }) => (
    <div
        onMouseLeave={onMouseLeave}
        style={style}
        className={cn(
            'absolute min-w-[12rem] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 transition-all duration-200',
            className
        )}
    >
        {children}
    </div>
);

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
};