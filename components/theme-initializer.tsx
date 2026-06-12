"use client"

import { useServerInsertedHTML } from "next/navigation"

export function ThemeInitializer() {
  useServerInsertedHTML(() => {
    return (
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const token = localStorage.getItem('ig_token');
                let userId = null;
                if (token) {
                  const parts = token.split('.');
                  if (parts.length === 3) {
                    userId = JSON.parse(atob(parts[1])).sub;
                  }
                }
                const theme = userId ? (localStorage.getItem('theme_' + userId) || 'dark') : 'dark';
                if (theme === 'light') {
                  document.documentElement.classList.add('light');
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
              } catch (e) {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
              }
            })()
          `
        }}
      />
    )
  })

  return null
}
