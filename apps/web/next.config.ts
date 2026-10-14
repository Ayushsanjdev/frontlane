import type {NextConfig} from 'next';
import {fileURLToPath} from 'node:url';

const config:NextConfig={
  output:'standalone',
  poweredByHeader:false,
  transpilePackages:['@frontlanejobs/core','@frontlanejobs/database'],
  outputFileTracingRoot:fileURLToPath(new URL('../../',import.meta.url)),
  async headers(){
    return ['hero-cf6853fa68f7.webp','hero-66067520ddb1.mp4','hero-0b4e8c356441.webm'].map(asset=>({
      source:`/videos/${asset}`,
      headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}],
    }));
  },
};
export default config;
