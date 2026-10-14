import type {ExpoConfig} from 'expo/config';
const iosClientId=process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const appId=process.env.MOBILE_APP_ID||'com.frontlanejobs.mobile';
const config:ExpoConfig={
  name:'FrontlaneJobs',slug:'frontlanejobs-mobile',version:'1.0.0',scheme:'frontlanejobs',
  orientation:'portrait',userInterfaceStyle:'automatic',
  ios:{bundleIdentifier:appId,supportsTablet:true,infoPlist:{NSAppTransportSecurity:{NSAllowsLocalNetworking:true}}},
  android:{package:appId},
  plugins:['expo-router','expo-secure-store','expo-dev-client','expo-status-bar','expo-font',['expo-build-properties',{ios:{enableSceneSupport:true,extraPods:iosClientId?[]:['AppCheckCore','GoogleUtilities','RecaptchaInterop'].map(name=>({name,modular_headers:true}))}}],
    // Add the Google plugin only once iOS credentials exist; browsing remains buildable.
    ...(iosClientId?[['react-native-nitro-google-signin',{iosUrlScheme:iosClientId.split('.').reverse().join('.')} ] as [string,Record<string,string>],'./plugins/with-google-redirect.cjs']:[]),
  ],
  extra:{...(process.env.EAS_PROJECT_ID?{eas:{projectId:process.env.EAS_PROJECT_ID}}:{})},
};
export default config;
