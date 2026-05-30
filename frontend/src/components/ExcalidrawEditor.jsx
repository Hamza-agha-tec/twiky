'use client';

import { useState, useEffect } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function ExcalidrawEditor({ initialData, onChange, onMount, theme, isPresenting, ...props }) {
    const [excalidrawAPI, setExcalidrawAPI] = useState(null);

    useEffect(() => {
        if (excalidrawAPI && initialData) {
            excalidrawAPI.updateScene(initialData);
        }
    }, [excalidrawAPI, initialData]);

    return (
        <div className="h-full w-full">
            <Excalidraw
                theme={theme}
                viewModeEnabled={isPresenting}
                excalidrawAPI={(api) => {
                    setExcalidrawAPI(api);
                    if (onMount) onMount(api);
                }}
                initialData={initialData}
                onChange={(elements, appState, files) => {
                    if (onChange) {
                        onChange(elements, appState, files);
                    }
                }}
                UIOptions={{
                    canvasActions: {
                        saveToActiveFile: false,
                        loadScene: false,
                        export: { saveFileToDisk: true },
                        toggleTheme: false,

                    },
                }}
                {...props}
            >
                <MainMenu>
                    <MainMenu.DefaultItems.LoadScene />
                    <MainMenu.DefaultItems.SaveToActiveFile />
                    <MainMenu.DefaultItems.Export />
                    <MainMenu.DefaultItems.SaveAsImage />
                    <MainMenu.DefaultItems.Help />
                    <MainMenu.DefaultItems.ClearCanvas />
                    <MainMenu.Separator />
                    <MainMenu.DefaultItems.ChangeCanvasBackground />
                </MainMenu>
                <WelcomeScreen />
            </Excalidraw>
        </div>
    );
}
