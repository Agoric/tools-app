import { Config } from 'tailwindcss';

const tailwindConfig: Config = {
  content: ['app/**/*.tsx'],
  plugins: [],
  theme: {
    extend: {
      colors: {
        main: '#BB2D40',
      },
    },
  },
};

export default tailwindConfig;
