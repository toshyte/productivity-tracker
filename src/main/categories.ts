import { getAllApps, setAppCategory as dbSetCategory, getDb } from './database'
import type { AppCategory } from '../shared/types'

// Default categories for common apps
const DEFAULT_CATEGORIES: Record<string, 'productive' | 'neutral' | 'distracting'> = {
  // Productive — coding & dev
  'Visual Studio Code': 'productive',
  'Code': 'productive',
  'Xcode': 'productive',
  'IntelliJ IDEA': 'productive',
  'WebStorm': 'productive',
  'PyCharm': 'productive',
  'Android Studio': 'productive',
  'Sublime Text': 'productive',
  'Atom': 'productive',
  'Terminal': 'productive',
  'iTerm2': 'productive',
  'Warp': 'productive',
  'Alacritty': 'productive',
  'kitty': 'productive',
  'Hyper': 'productive',
  'Claude': 'productive',
  'Cursor': 'productive',
  'Zed': 'productive',
  'Nova': 'productive',
  'Docker Desktop': 'productive',
  'Postman': 'productive',
  'Insomnia': 'productive',
  'TablePlus': 'productive',
  'pgAdmin': 'productive',
  'GitHub Desktop': 'productive',
  'Tower': 'productive',
  'Fork': 'productive',
  'Sourcetree': 'productive',

  // Productive — design & creative
  'Figma': 'productive',
  'Sketch': 'productive',
  'Adobe Photoshop': 'productive',
  'Adobe Illustrator': 'productive',
  'Adobe XD': 'productive',
  'Affinity Designer': 'productive',
  'Affinity Photo': 'productive',
  'Blender': 'productive',
  'Canva': 'productive',

  // Productive — writing & docs
  'Notion': 'productive',
  'Obsidian': 'productive',
  'Microsoft Word': 'productive',
  'Pages': 'productive',
  'Google Docs': 'productive',
  'Bear': 'productive',
  'Ulysses': 'productive',
  'iA Writer': 'productive',
  'Typora': 'productive',
  'Notes': 'productive',

  // Productive — spreadsheets & data
  'Microsoft Excel': 'productive',
  'Numbers': 'productive',
  'Google Sheets': 'productive',

  // Productive — presentations
  'Microsoft PowerPoint': 'productive',
  'Keynote': 'productive',

  // Productive — project management
  'Linear': 'productive',
  'Jira': 'productive',
  'Asana': 'productive',
  'Trello': 'productive',
  'Monday': 'productive',
  'ClickUp': 'productive',
  'Todoist': 'productive',
  'Things': 'productive',
  'OmniFocus': 'productive',

  // Neutral — communication
  'Slack': 'neutral',
  'Microsoft Teams': 'neutral',
  'Discord': 'neutral',
  'Zoom': 'neutral',
  'Google Meet': 'neutral',
  'Skype': 'neutral',
  'WhatsApp': 'neutral',
  'Telegram': 'neutral',
  'Messages': 'neutral',
  'Mail': 'neutral',
  'Microsoft Outlook': 'neutral',
  'Thunderbird': 'neutral',
  'Spark': 'neutral',

  // Neutral — browsers (depends on content, default neutral)
  'Google Chrome': 'neutral',
  'Safari': 'neutral',
  'firefox': 'neutral',
  'Firefox': 'neutral',
  'Arc': 'neutral',
  'Brave Browser': 'neutral',
  'Microsoft Edge': 'neutral',
  'Opera': 'neutral',
  'Vivaldi': 'neutral',

  // Neutral — system
  'Finder': 'neutral',
  'System Settings': 'neutral',
  'System Preferences': 'neutral',
  'Activity Monitor': 'neutral',
  'Preview': 'neutral',
  'Calendar': 'neutral',
  'Reminders': 'neutral',
  'Calculator': 'neutral',
  '1Password': 'neutral',
  'Bitwarden': 'neutral',
  'Raycast': 'neutral',
  'Alfred': 'neutral',
  'Spotlight': 'neutral',

  // Neutral — file management
  'Transmit': 'neutral',
  'Cyberduck': 'neutral',
  'FileZilla': 'neutral',

  // Distracting — social media
  'Twitter': 'distracting',
  'X': 'distracting',
  'Facebook': 'distracting',
  'Instagram': 'distracting',
  'TikTok': 'distracting',
  'Reddit': 'distracting',
  'Tumblr': 'distracting',

  // Distracting — entertainment
  'YouTube': 'distracting',
  'Netflix': 'distracting',
  'Spotify': 'distracting',
  'Apple Music': 'distracting',
  'Music': 'distracting',
  'TV': 'distracting',
  'VLC': 'distracting',
  'IINA': 'distracting',
  'Steam': 'distracting',
  'Epic Games Launcher': 'distracting',

  // Distracting — news & browsing
  'News': 'distracting',
  'Apple News': 'distracting'
}

export function getCategories(): AppCategory[] {
  return getAllApps()
}

export function updateCategory(appName: string, category: string): void {
  dbSetCategory(appName, category)
}

/** Auto-categorize any new apps that don't have a category yet */
export function autoCategorizeNewApps(): void {
  const db = getDb()
  const uncategorized = db.prepare(`
    SELECT DISTINCT e.app_name
    FROM tracking_entries e
    LEFT JOIN app_categories c ON e.app_name = c.app_name
    WHERE c.app_name IS NULL AND e.is_idle = 0
  `).all() as { app_name: string }[]

  for (const { app_name } of uncategorized) {
    const category = DEFAULT_CATEGORIES[app_name]
    if (category) {
      dbSetCategory(app_name, category)
    }
  }
}

/** Get the default category for an app name (used at insert time) */
export function getDefaultCategory(appName: string): string {
  return DEFAULT_CATEGORIES[appName] || 'neutral'
}
