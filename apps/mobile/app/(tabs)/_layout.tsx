import {Tabs} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useApp} from '../../src/providers';
export default function TabLayout(){
  const {colors}=useApp();
  return <Tabs screenOptions={{headerStyle:{backgroundColor:colors.background},headerTintColor:colors.text,headerShadowVisible:false,tabBarStyle:{backgroundColor:colors.card,borderTopColor:colors.border},tabBarActiveTintColor:colors.primary,tabBarInactiveTintColor:colors.muted}}>
    <Tabs.Screen name="index" options={{title:'FrontlaneJobs',tabBarLabel:'Jobs',tabBarIcon:({color,size})=><Ionicons name="search-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="tracker" options={{title:'Your tracker',tabBarLabel:'Tracker',tabBarIcon:({color,size})=><Ionicons name="layers-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="account" options={{title:'Your account',tabBarLabel:'Account',tabBarIcon:({color,size})=><Ionicons name="person-circle-outline" color={color} size={size}/>}}/>
  </Tabs>;
}
