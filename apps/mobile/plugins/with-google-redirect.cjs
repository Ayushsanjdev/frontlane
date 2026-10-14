const {withAppDelegate}=require('expo/config-plugins');

// Expo's scene delegate forwards URL events to AppDelegate, including cold starts.
function forwardGoogleUrls(contents){
  if(contents.includes('if GIDSignIn.sharedInstance.handle(url)'))return contents;
  const target='return super.application(app, open: url, options: options)';
  if(!contents.includes(target))throw Error('Google sign-in requires the Expo Swift AppDelegate URL handler.');
  return 'import GoogleSignIn\n'+contents.replace(target,'if GIDSignIn.sharedInstance.handle(url) { return true }\n    '+target);
}
module.exports=config=>withAppDelegate(config,result=>{
  if(result.modResults.language!=='swift')throw Error('Google sign-in requires a Swift AppDelegate.');
  result.modResults.contents=forwardGoogleUrls(result.modResults.contents);
  return result;
});
module.exports.forwardGoogleUrls=forwardGoogleUrls;
