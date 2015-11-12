import url from 'url'
import querystring from 'querystring'

export let onLaunch = (handler, {whitelist=null}={})=>{
  const query = url.parse(window.location.href, true).query
  const win = (window.opener || window.parent)

  if (!query || !query.origin || query.mode !== 'postMessage'){
    return;
  }

  const origin = originOf(query.origin)
  const params = {}
  const options = {win: win, origin: origin, params: params}

  if (whitelist && whitelist.filter((x) => x === origin).length === 0) {
    return;
  }

  win.postMessage("ready", origin)
  awaitMessage(options, (event)=>{
    handler(
      event.data,
      (resolveValue)=>{
        win.postMessage({resolve: resolveValue}, origin)
      },
      (rejectValue)=>{
        win.postMessage({reject: rejectValue})
      })
  })

}

export let launch = (url, win, params={})=>{
  win.location = url + "?mode=postMessage&origin="+encodeURIComponent(location.origin)
  return Promise.resolve({
    origin: originOf(url),
    win: win,
    params: params
  })
  .then(awaitLoad)
  .then(callApp)
}

function originOf(val){
  const parsed = url.parse(val)
  return parsed.protocol + '//' + parsed.host
}

function awaitMessage(options, cb){
  const {win, origin, params} = options
  //console.log("Await on", options, cb)
  var onEvent = (event)=>{
    //console.log("Event received", event)
    if (origin !== "*" && event.origin !== origin) {
      //console.log("Origin didn't match", event.origin, origin)
      return;
    }
    if (event.source !== win){
      //console.log("source window didn't match", event.source, win)
      return;
    }
    //console.log("Calling back", cb)
    window.removeEventListener("message", onEvent)
    cb(event)
  }

  window.addEventListener("message", onEvent)
}

function awaitLoad(options){
  return new Promise((resolve, reject)=>{
    awaitMessage(options, (event)=>resolve(options))
  })
}

function callApp(options){
  const {win, origin, params} = options
  return new Promise((resolve, reject)=>{
    win.postMessage(params, origin)
    awaitMessage(options, (event)=>{
      if (event.data.reject) {
        //console.log("reject final pfomise from", event)
        return reject(event.data.reject)
      }
      //console.log("Resolve final pfomise from", event.data.resolve)
      return resolve(event.data.resolve)
    })
  })
}
