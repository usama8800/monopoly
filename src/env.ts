import dotenvPlus from '@usama8800/dotenvplus';

export const env = dotenvPlus<{
  MODE: 'dev' | 'prod';
}>({
  required: [
    {
      or: [
        { key: 'MODE', value: 'dev' },
        { key: 'MODE', value: 'prod' },
      ]
    }
  ],
  maps: {
  },
  override: true,
});
