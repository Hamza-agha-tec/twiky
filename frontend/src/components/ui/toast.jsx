import * as React from "react"
import toastLib, { Toaster as HotToaster } from "react-hot-toast"
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

// Custom toast renderer
const renderToast = (t) => (
  <div
    className={cn(
      "flex w-full max-w-sm items-center gap-3 rounded-lg border p-4 shadow-lg transition-all",
      t.type === "success" &&
      "border-green-500/20 bg-green-50 dark:bg-green-950/50",
      t.type === "error" &&
      "border-red-500/20 bg-red-50 dark:bg-red-950/50",
      t.type === "loading" && "border-blue-500/20 bg-blue-50",
      t.visible ? "animate-in fade-in" : "animate-out fade-out"
    )}
  >
    {/* ICONS */}
    {t.type === "success" && (
      <CheckCircle className="h-5 w-5 text-green-500" />
    )}
    {t.type === "error" && (
      <XCircle className="h-5 w-5 text-red-500" />
    )}
    {t.type === "loading" && (
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    )}

    {t.type !== "success" &&
      t.type !== "error" &&
      t.type !== "loading" && (
        <AlertCircle className="h-5 w-5 text-blue-500" />
      )}

    {/* MESSAGE */}
    <div className="flex-1">
      <p className="text-sm font-medium">{t.message}</p>
    </div>

    {/* DISMISS BUTTON */}
    <button
      onClick={() => toastLib.dismiss(t.id)}
      className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
)

const Toaster = () => (
  <HotToaster
    position="top-center"
    toastOptions={{
      duration: 5000,
      style: { background: "transparent", boxShadow: "none" },

      // CUSTOM toasts
      success: {
        render: renderToast,
      },
      error: {
        render: renderToast,
      },
      loading: {
        render: renderToast,
      },
    }}
  />
)

const toast = Object.assign(
  (message) => toastLib(message),
  {
    success: (message) => toastLib.success(message),
    error: (message) => toastLib.error(message),
    loading: (message) => toastLib.loading(message),
    dismiss: (id) => toastLib.dismiss(id),
    promise: (promise, msgs) => toastLib.promise(promise, msgs),
  }
)


export { Toaster, toast }
