import React from 'react';

/**
 * Simple ScrollArea component as a fallback when shadcn/ui ScrollArea is not available.
 * It provides a container with overflow auto and accepts custom className.
 */
export function ScrollArea({ className = '', children }) {
    return (
        <div className={`overflow-auto ${className}`}> {children} </div>
    );
}

export default ScrollArea;
