'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  // On mount: read localStorage (or system preference)
  useEffect(() => {
    const stored = localStorage.getItem('drishti-theme') as Theme | null
    if (stored === 'dark' || stored === 'light') {
      apply(stored)
      setThemeState(stored)
    } else {
      // Respect OS preference as default
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const initial: Theme = prefersDark ? 'dark' : 'light'
      apply(initial)
      setThemeState(initial)
    }
  }, [])

  function apply(t: Theme) {
    const root = document.documentElement
    root.classList.toggle('dark', t === 'dark')
  }

  function setTheme(t: Theme) {
    apply(t)
    setThemeState(t)
    localStorage.setItem('drishti-theme', t)
  }

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
