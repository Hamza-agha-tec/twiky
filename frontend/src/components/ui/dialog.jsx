'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = ({ children, open, onOpenChange }) => {
    const [isOpen, setIsOpen] = React.useState(open || false);

    React.useEffect(() => {
        if (open !== undefined) setIsOpen(open);
    }, [open]);

    const handleOpenChange = (val) => {
        setIsOpen(val);
        onOpenChange?.(val);
    };

    return (
        <div className="dialog-root">
            {React.Children.map(children, (child) => {
                if (child.type === DialogTrigger) {
                    return React.cloneElement(child, { onClick: () => handleOpenChange(true) });
                }
                if (child.type === DialogContent) {
                    return (
                        <AnimatePresence>
                            {isOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => handleOpenChange(false)}
                                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
                                    />
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        transition={{ type: 'tween', ease: 'easeInOut', duration: 0.4, layout: { duration: 0.4, ease: 'easeInOut' } }}
                                        className={cn(
                                            'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900',
                                            child.props.className
                                        )}
                                    >
                                        <button
                                            onClick={() => handleOpenChange(false)}
                                            className="absolute right-4 top-4 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:focus:ring-indigo-500"
                                        >
                                            <X className="h-4 w-4" />
                                            <span className="sr-only">Close</span>
                                        </button>
                                        {child.props.children}
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    );
                }
                return child;
            })}
        </div>
    );
};

const DialogTrigger = ({ children, onClick, asChild }) => {
    if (asChild) {
        return React.cloneElement(children, { onClick });
    }
    return <button onClick={onClick}>{children}</button>;
};

const DialogContent = ({ children, className }) => <>{children}</>;

const DialogHeader = ({ className, ...props }) => (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)} {...props} />
);

const DialogFooter = ({ className, ...props }) => (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6', className)} {...props} />
);

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
    <h2
        ref={ref}
        className={cn('text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50', className)}
        {...props}
    />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn('text-sm text-slate-500 dark:text-slate-400', className)}
        {...props}
    />
));
DialogDescription.displayName = 'DialogDescription';

export {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
};
