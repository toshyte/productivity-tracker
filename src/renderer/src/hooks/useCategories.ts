import { useState, useEffect, useCallback } from 'react'
import { getAllApps, setAppCategory } from '../lib/ipc'
import type { AppCategory } from '../../../shared/types'

export function useCategories() {
  const [categories, setCategories] = useState<AppCategory[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    try {
      const apps = await getAllApps()
      setCategories(apps)
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const updateCategory = useCallback(
    async (appName: string, category: string) => {
      await setAppCategory(appName, category)
      setCategories((prev) =>
        prev.map((c) => (c.app_name === appName ? { ...c, category: category as AppCategory['category'] } : c))
      )
    },
    []
  )

  return { categories, loading, updateCategory, refresh: fetchCategories }
}
