'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const AlertDialog = ({ children, open, onOpenChange }) => {
    const [isOpen, setIsOpen] = React.useState(open || false);

    React.useEffect(() => {
        if (open !== undefined) setIsOpen(open);
    }, [open]);

    const handleOpenChange = (val) => {
        setIsOpen(val);
        onOpenChange?.(val);
    };

    return (
        <div className="alert-dialog-root">
            {React.Children.map(children, (child) => {
                if (child.type === AlertDialogTrigger) {
                    return React.cloneElement(child, { onClick: () => handleOpenChange(true) });
                }
                if (child.type === AlertDialogContent) {
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
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                        className={cn(
                                            'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900',
                                            child.props.className
                                        )}
                                    >
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

const AlertDialogTrigger = ({ children, onClick, asChild }) => {
    if (asChild) {
        return React.cloneElement(children, { onClick });
    }
    return <button onClick={onClick}>{children}</button>;
};

const AlertDialogContent = ({ children, className }) => <>{children}</>;

const AlertDialogHeader = ({ className, ...props }) => (
    <div className={cn('flex flex-col space-y-2 text-center sm:text-left mb-4', className)} {...props} />
);

const AlertDialogFooter = ({ className, ...props }) => (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6', className)} {...props} />
);

const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (
    <h2
        ref={ref}
        className={cn('text-lg font-semibold text-slate-900 dark:text-slate-50', className)}
        {...props}
    />
));
AlertDialogTitle.displayName = 'AlertDialogTitle';

const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn('text-sm text-slate-500 dark:text-slate-400', className)}
        {...props}
    />
));
AlertDialogDescription.displayName = 'AlertDialogDescription';

const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => (
    <Button ref={ref} className={cn(className)} {...props} />
));
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => (
    <Button
        ref={ref}
        variant="outline"
        className={cn('mt-2 sm:mt-0', className)}
        {...props}
    />
));
AlertDialogCancel.displayName = 'AlertDialogCancel';

export {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
};
