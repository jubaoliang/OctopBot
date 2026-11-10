// SVG assets load as React components via react-native-svg-transformer.
declare module '*.svg' {
  import type { ComponentType } from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: ComponentType<SvgProps>;
  export default content;
}
