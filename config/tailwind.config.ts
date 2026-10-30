import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ios: {
          bg: '#000000',
          card: '#1C1C1E',
          'card-hover': '#2C2C2E',
          input: '#2C2C2E',
          separator: '#38383A',
          subtext: '#8E8E93',
          blue: '#0A84FF',
          green: '#30D158',
          red: '#FF453A',
          orange: '#FF9F0A',
          purple: '#BF5AF2',
        },
      },
    },
  },
  plugins: [],
};

export default config;
