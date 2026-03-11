import { Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import { isTracking, toggleTracking } from './tracker'
import path from 'path'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): Tray {
  // Create a simple 16x16 tray icon
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEzSURBVDiNpZMxTsMwFIa/Z6dNJZAYWJg4AhOX4AZcghtwAhbuwMzGwsTGACNLpUqN7WcGJ01TBfhHy+/97/f/bBn+KYmIt4j4fK/eiIiT/4D3AsCL1jpzzq3WWq9EZAEcAa/AQ0ScjOAC2BORc2NMAUxV9RbIgQwogG1V3RCRE+DZGFMBuaoWqnoyTdPH+cBJ0OcdsBCRc+AayBljU9EdhYhIFUJ4Br5KKY2qWohoGXg6g5NhBzgFAB4BnHPuWVXLqYHv5AMnoKr+1LZ9b5omrCML4BHYBXDOeaDoup4QwqHW+mb8BrCPiAsROQLOgBvn3G5d15RSihBCHUI4tNZ+DMBLYA84FZErEbkEzoBt59xOXddUVRVCCGdFUezP+9cy0P/GOI5CCB+ttW+Tfz4BfANFuoQzJbMhQgAAAABJRU5ErkJggg=='
  )

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Productivity Tracker')

  updateTrayMenu(mainWindow)

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  return tray
}

export function updateTrayMenu(mainWindow: BrowserWindow): void {
  if (!tray) return

  const tracking = isTracking()

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    {
      label: tracking ? 'Pause Tracking' : 'Resume Tracking',
      click: () => {
        toggleTracking()
        updateTrayMenu(mainWindow)
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        mainWindow.destroy()
        process.exit(0)
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}
