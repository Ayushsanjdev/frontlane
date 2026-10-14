import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppProvider,useApp} from '../src/providers';
function Navigation(){
  const {colors,dark,user}=useApp();
  return <><StatusBar style={dark?'light':'dark'}/><Stack key={user?.userId||'guest'} screenOptions={{headerStyle:{backgroundColor:colors.background},headerTintColor:colors.text,headerShadowVisible:false,contentStyle:{backgroundColor:colors.background}}}>
    <Stack.Screen name="(tabs)" options={{headerShown:false}}/>
    <Stack.Screen name="jobs/[id]" options={{title:'The opportunity'}}/>
    <Stack.Screen name="applications/[id]" options={{title:'Application details'}}/>
    <Stack.Screen name="publish" options={{title:'Add a job',presentation:'modal'}}/>
  </Stack></>;
}
export default function RootLayout(){return <SafeAreaProvider><AppProvider><Navigation/></AppProvider></SafeAreaProvider>}
