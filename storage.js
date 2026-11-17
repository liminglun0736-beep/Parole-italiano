/* Browser-local storage; dictionaries are never uploaded. Each Pages base path has its own namespace. */
const ParolaStore = (() => {
  const DB_NAME='parola-storage-v1', STORE='state';
  function create(namespace, options={}) {
    const idb=options.indexedDB===undefined?globalThis.indexedDB:options.indexedDB;
    let local;try{local=options.localStorage===undefined?globalThis.localStorage:options.localStorage}catch{}
    let database,opening,queue=Promise.resolve(),pendingCount=0,lastCustom;
    const metaKey=namespace+':meta',customKey=namespace+':custom';
    function open(){
      if(database)return Promise.resolve(database);
      if(opening)return opening;
      opening=new Promise((resolve,reject)=>{
        const request=idb.open(DB_NAME,1);
        request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
        request.onerror=()=>reject(request.error||Error('无法打开本地数据库'));
        request.onblocked=()=>reject(Error('本地数据库被旧页面占用，请关闭其他 Parola 页面后重试。'));
        request.onsuccess=()=>{database=request.result;database.onversionchange=()=>{database.close();database=null;opening=null};resolve(database)};
      });return opening;
    }
    async function read(){const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction([STORE],'readonly'),store=tx.objectStore(STORE),meta=store.get(metaKey),custom=store.get(customKey);
      tx.oncomplete=()=>resolve(meta.result?{...meta.result,custom:custom.result||[]}:null);
      tx.onerror=tx.onabort=()=>reject(tx.error||Error('读取本地数据库失败'));
    })}
    async function write(meta,custom){const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction([STORE],'readwrite'),store=tx.objectStore(STORE);
      try{store.put(meta,metaKey);if(custom!==lastCustom)store.put(custom,customKey)}catch(error){tx.abort();reject(error);return}
      tx.oncomplete=()=>{lastCustom=custom;try{local?.setItem(namespace+':indexeddb','1')}catch{}resolve()};
      tx.onerror=tx.onabort=()=>reject(tx.error||Error('本地数据库保存失败，可能已超出浏览器存储空间。'));
    })}
    function save(state){
      // Metadata is captured at enqueue time. Dictionary arrays are replaced, never mutated in place.
      const meta=JSON.parse(JSON.stringify({...state,custom:undefined})),custom=state.custom;
      pendingCount++;
      const task=queue.then(async()=>{
        if(idb)await write(meta,custom);
        else {if(local?.getItem(namespace+':indexeddb'))throw Error('当前浏览器无法使用 IndexedDB；为保护已有词库，请启用本地数据库后重试。');if(!local)throw Error('当前浏览器不支持本地保存');local.setItem(namespace,JSON.stringify({...meta,custom}));lastCustom=custom}
      });
      queue=task.catch(()=>{});
      return task.finally(()=>pendingCount--);
    }
    async function load(){
      if(idb){const saved=await read();if(saved){lastCustom=saved.custom;return saved}}
      else if(local?.getItem(namespace+':indexeddb'))throw Error('当前浏览器无法使用已有词库的 IndexedDB，请启用本地数据库后重试。');
      if(!idb&&!local)throw Error('当前浏览器禁止本地保存，请启用浏览器存储后重试。');
      const text=local?.getItem(namespace);if(!text)return null;
      const legacy=JSON.parse(text);
      if(!legacy||!legacy.progress||!Array.isArray(legacy.custom)||!legacy.daily)throw Error('旧学习数据格式异常，原始数据已保留。');
      if(idb)await save(legacy); // Retain the old localStorage copy until the new transaction commits (and afterwards).
      return legacy;
    }
    return {load,save,pending:()=>pendingCount>0};
  }
  return {create};
})();
