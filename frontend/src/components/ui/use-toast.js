import { useCallback } from 'react'
import { toast } from '@/components/ui/toast'

export function useToast() {
  const showToast = useCallback(({ title, description, variant = 'default' }) => {
    const message = description ? (
      <div>
        {title && <p className="font-medium">{title}</p>}
        {description && <p className="text-sm opacity-90">{description}</p>}
      </div>
    ) : (
      title
    )

    switch (variant) {
      case 'success':
        return toast.success(message)
      case 'error':
      case 'destructive':
        return toast.error(message)
      case 'loading':
        return toast.loading(message)
      default:
        return toast(message)

    }
  }, [])

  return {
    toast: showToast,
    dismiss: toast.dismiss,
  }
}
