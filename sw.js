const CACHE_NAME = 'shipyard-nagar-v4'; // അടുത്ത അപ്ഡേറ്റിൽ ഇത് v4 ആക്കുക
const assets = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. ഇൻസ്റ്റാൾ ചെയ്യുമ്പോൾ പുതിയ ഫയലുകൾ ഉടൻ ഡൗൺലോഡ് ചെയ്യാൻ
self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// 2. ആക്റ്റീവ് ആകുമ്പോൾ പഴയ വേർഷൻ ഫയലുകൾ ഡിലീറ്റ് ചെയ്യാൻ
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Old cache removed:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // ഉടൻ നിയന്ത്രണം ഏറ്റെടുക്കാൻ
});

// 3. ഫയലുകൾ സെർച്ച് ചെയ്യുമ്പോൾ ക്യാഷിൽ ഉണ്ടോ എന്ന് നോക്കാൻ
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
