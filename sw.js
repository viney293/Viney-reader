// Vineys Reader — service worker
// Caches the app shell so it installs as an app and works offline.

var CACHE_NAME = "vineys-reader-v27";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./cover.jpg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      // Add files one by one so a single missing file can't stop the whole install.
      return Promise.all(ASSETS.map(function(a){ return cache.add(a).catch(function(){}); }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  if (event.request.method !== "GET") return;
  // The list of valid access keys must always be fresh, never cached.
  if (new URL(event.request.url).pathname.slice(-9) === "keys.json"){
    event.respondWith(fetch(event.request).catch(function(){
      return new Response('{"v":1,"hashes":[]}', { headers: { "Content-Type": "application/json" } });
    }));
    return;
  }
  // Pages load from the network first, so updates reach people straight away;
  // the saved copy is only used when they are offline.
  if (event.request.mode === "navigate"){
    event.respondWith(fetch(event.request).then(function(response){
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
      return response;
    }).catch(function(){
      return caches.match(event.request).then(function(r){ return r || caches.match("./index.html"); });
    }));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached){
      if (cached) return cached;
      return fetch(event.request).then(function(response){
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        return response;
      }).catch(function(){
        if (event.request.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
