module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '\\.svg$': '<rootDir>/src/test/svg-mock.tsx',
  },
  transformIgnorePatterns: [
    'jest-expo/public/__mocks__/@react-native-assets/.*',
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  collectCoverageFrom: ['src/core/**/*.{ts,tsx}'],
};
