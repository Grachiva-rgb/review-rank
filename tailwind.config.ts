import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        brand: {
          bg: '#FAF7F0',
          text: '#241C15',
          terracotta: '#8B5E3C',
          'terracotta-hover': '#6B4A2F',
          teal: '#2F6F4E',
          gold: '#F4B400',
        },
      },
    },
  },
  plugins: [],
};

export default config;
