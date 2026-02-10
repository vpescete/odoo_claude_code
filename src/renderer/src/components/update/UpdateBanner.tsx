import { useState, useEffect } from 'react'
import { Download, RotateCcw, X } from 'lucide-react'
import type { UpdateInfo, UpdateProgress } from '@shared/types/update'

type BannerState = 'hidden' | 'available' | 'downloading' | 'ready'

export function UpdateBanner() {
  const [state, setState] = useState<BannerState>('hidden')
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const unsubAvailable = window.api.on.updateAvailable((data: UpdateInfo) => {
      setInfo(data)
      setState('available')
    })
    const unsubProgress = window.api.on.updateDownloadProgress((data: UpdateProgress) => {
      setProgress(Math.round(data.percent))
    })
    const unsubReady = window.api.on.updateReady((data: UpdateInfo) => {
      setInfo(data)
      setState('ready')
    })

    // Check if an update was already detected
    window.api.update.getInfo().then((existing) => {
      if (existing) {
        setInfo(existing)
        setState('available')
      }
    })

    return () => {
      unsubAvailable()
      unsubProgress()
      unsubReady()
    }
  }, [])

  if (state === 'hidden') return null

  const handleDownload = () => {
    setState('downloading')
    window.api.update.download()
  }

  const handleInstall = () => {
    window.api.update.install()
  }

  const handleDismiss = () => {
    setState('hidden')
  }

  return (
    <div className="h-8 px-4 flex items-center justify-between bg-primary text-primary-foreground text-xs shrink-0">
      <div className="flex items-center gap-2">
        {state === 'available' && (
          <>
            <span>Update available! v{info?.version}</span>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors"
            >
              <Download size={12} />
              Download
            </button>
          </>
        )}
        {state === 'downloading' && (
          <span>Downloading... {progress}%</span>
        )}
        {state === 'ready' && (
          <>
            <span>Update ready! Installs on quit.</span>
            <button
              onClick={handleInstall}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors"
            >
              <RotateCcw size={12} />
              Restart & Install
            </button>
          </>
        )}
      </div>
      <button onClick={handleDismiss} className="hover:bg-primary-foreground/20 rounded p-0.5 transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}
