import dotenvPlus from '@usama8800/dotenvplus';

export const env = dotenvPlus<{
  MODE: 'dev' | 'prod' | 'test';
}>({
  required: [
    {
      or: [
        { key: 'MODE', value: 'dev' },
        { key: 'MODE', value: 'prod' },
        { key: 'MODE', value: 'test' },
      ]
    }
  ],
  maps: {
  },
  override: true,
});
