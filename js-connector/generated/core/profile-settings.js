// Generated from the preserved Node/Python application.
export function profileSettings(saved={},user={}){
 const automatic=/^ru(?:[-_]|$)/i.test(String(user.languageCode||''))?'ru':'en';
 return {language:['ru','en'].includes(saved.language)?saved.language:automatic,privateProfile:saved.privateProfile===true};
}
export function updateProfileSettings(saved,input){
 if(!input||!['ru','en'].includes(input.language))throw Error('Выбери русский или английский язык.');
 if(typeof input.privateProfile!=='boolean')throw Error('Укажи режим приватности профиля.');
 return {...saved,language:input.language,privateProfile:input.privateProfile};
}
