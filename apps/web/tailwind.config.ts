import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#5E6AD2',
        success: '#3FB950',
        warning: '#F5A623',
        danger: '#F85149',
        surface: '#0D0F14',
        'surface-2': '#13161D',
        'surface-3': '#1B1E26',
        border: 'rgba(255,255,255,0.07)',
        muted: '#6B7280',
        'text-primary': '#F0F0F0',
        'text-secondary': '#9aa0ab',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
};

export default config;
