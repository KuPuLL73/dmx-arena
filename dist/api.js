/* Transport switch only. Identity always comes from a verified server context. */
window.DMXApi={
 async call(name,input={}){
  const tg=window.Telegram?.WebApp;
  if(location.hostname.endsWith('.tgcloud.ai')&&tg?.Serverless?.call){
   return new Promise((resolve,reject)=>tg.Serverless.call(name,input,(error,result)=>error?reject(Error(error.message)):resolve(result)));
  }
  const publicRead=['getLeaderboard','getTournaments','getClanMaps','getPublicProfile','getClanMembers'].includes(name);
  const query=publicRead?'?'+new URLSearchParams(input):'';
  let response;
  try{response=await fetch('./api/'+name+query,{method:publicRead?'GET':'POST',credentials:'same-origin',signal:AbortSignal.timeout(65000),headers:{'Content-Type':'application/json','X-DMX-Request':'1',...(tg?.initData?{Authorization:'tma '+tg.initData}:{})},...(publicRead?{}:{body:JSON.stringify(input)})});}
  catch(error){throw Error(navigator.onLine===false?'Нет подключения к интернету. Попробуй после восстановления связи.':error.name==='TimeoutError'?'Ответ задерживается. Попробуй ещё раз.':'Не удалось связаться с DMX. Попробуй ещё раз.');}
  let result;try{result=await response.json();}catch{throw Error('Сервер временно недоступен. Попробуй ещё раз.');}
  if(!response.ok)throw Error(result.error||'Подключение недоступно.');return result;
 }
};
