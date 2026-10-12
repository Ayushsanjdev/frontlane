import type {NextConfig} from 'next';
import {fileURLToPath} from 'node:url';

const config:NextConfig={
  output:'standalone',
  poweredByHeader:false,
  transpilePackages:['@frontlane/core','@frontlane/database'],
  outputFileTracingRoot:fileURLToPath(new URL('../../',import.meta.url)),
};
export default config;
