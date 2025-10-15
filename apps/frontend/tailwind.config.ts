import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'sans-serif']
      },
      colors: {
        primary: {
          gradient1: '#3b82f6',
          gradient2: '#9333ea'
        },
        secondary: {
          gradient1: '#34d399',
          gradient2: '#3b82f6'
        },
        tertiary: {
          gradient1: '#ec4899',
          gradient2: '#fb923c'
        }
      }
    }
  },
  plugins: []
};

export default config;
