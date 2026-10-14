import type {ReactNode} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View,type TextInputProps,type TextProps} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useApp} from './providers';

export const layout=StyleSheet.create({
  content:{padding:22,gap:18,width:'100%',maxWidth:760,alignSelf:'center'},
  row:{flexDirection:'row',alignItems:'center',gap:12,flexWrap:'wrap'},
  spread:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  stack:{gap:12},
});
export function Txt({children,tone='body',style,...props}:TextProps & {tone?:'body'|'muted'|'title'|'heading'|'label'}){
  const {colors}=useApp();
  const typography={body:{fontSize:16,lineHeight:24},muted:{fontSize:14,lineHeight:21},title:{fontSize:34,lineHeight:40,fontWeight:'700' as const,letterSpacing:-1},heading:{fontSize:21,lineHeight:27,fontWeight:'600' as const},label:{fontSize:14,lineHeight:20,fontWeight:'600' as const}};
  return <Text {...props} style={[{color:tone==='muted'?colors.muted:colors.text},typography[tone],style]}>{children}</Text>;
}
export function Screen({children,scroll=true}:{children:ReactNode;scroll?:boolean}){
  const {colors}=useApp();
  return <SafeAreaView edges={['bottom']} style={{flex:1,backgroundColor:colors.background}}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>{scroll?<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={layout.content}>{children}</ScrollView>:children}</KeyboardAvoidingView></SafeAreaView>;
}
export function Card({children}:{children:ReactNode}){
  const {colors}=useApp();return <View style={{padding:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,borderRadius:16,gap:14}}>{children}</View>;
}
export function Button({title,onPress,disabled=false,busy=false,secondary=false,icon}:{title:string;onPress:()=>void;disabled?:boolean;busy?:boolean;secondary?:boolean;icon?:keyof typeof Ionicons.glyphMap}){
  const {colors,dark}=useApp();const foreground=secondary?colors.primary:dark?'#101827':'#ffffff';
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy} onPress={onPress} style={({pressed})=>({minHeight:48,borderRadius:10,paddingHorizontal:18,paddingVertical:12,backgroundColor:secondary?colors.soft:colors.primary,opacity:(disabled||busy)?0.5:pressed?0.75:1,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'})}>{busy?<ActivityIndicator color={foreground}/>:icon?<Ionicons name={icon} color={foreground} size={19}/>:null}<Text style={{fontSize:15,fontWeight:'600',color:foreground}}>{title}</Text></Pressable>;
}
export function Field({label,...props}:TextInputProps & {label:string}){
  const {colors}=useApp();
  return <View style={{gap:7}}><Txt tone="label">{label}</Txt><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} autoCorrect={false} {...props} style={[{borderWidth:1,borderColor:colors.border,borderRadius:10,padding:13,minHeight:48,fontSize:16,color:colors.text,backgroundColor:colors.card,textAlignVertical:props.multiline?'top':'center'},props.multiline&&{minHeight:110},props.style]}/></View>;
}
export function Choices({label,value,options,onChange,labels={}}:{label:string;value:string;options:readonly string[];labels?:Record<string,string>;onChange:(value:string)=>void}){
  const {colors}=useApp();
  return <View style={{gap:8}}><Txt tone="label">{label}</Txt><View style={[layout.row,{gap:7}]}>{options.map(option=><Pressable key={option} accessibilityRole="radio" accessibilityLabel={option} accessibilityState={{selected:option===value}} onPress={()=>onChange(option)} style={{minHeight:44,paddingHorizontal:12,paddingVertical:11,borderRadius:9,borderWidth:1,borderColor:value===option?colors.primary:colors.border,backgroundColor:value===option?colors.soft:colors.card}}><Text style={{fontSize:13,fontWeight:value===option?'600':'400',color:value===option?colors.primary:colors.muted}}>{labels[option]||option}</Text></Pressable>)}</View></View>;
}
export function Notice({message,error=false}:{message:string;error?:boolean}){
  const {colors}=useApp();return message?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{padding:14,borderRadius:10,backgroundColor:colors.soft}}><Txt style={{color:error?colors.error:colors.text,fontSize:14}}>{message}</Txt></View>:null;
}
export function Loading(){const {colors}=useApp();return <ActivityIndicator style={{padding:32}} color={colors.primary} accessibilityLabel="Loading"/>}
export function AuthGate({message='Sign in to keep your career workspace across devices.'}:{message?:string}){
  const {signIn,authBusy,authError,ready,restore}=useApp();
  return <Card><Ionicons name="lock-closed-outline" size={28} color={useApp().colors.primary}/><Txt tone="heading">Your private workspace</Txt><Txt tone="muted">{message}</Txt><Notice message={authError} error/><Button title="Continue with Google" onPress={()=>void signIn()} busy={authBusy||!ready} icon="logo-google"/>{!!authError&&<Button title="Retry session" secondary onPress={()=>void restore()} disabled={authBusy}/>}</Card>;
}
