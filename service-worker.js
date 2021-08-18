// This service worker will never refetch assets once it's installed the first time.  This means that in order for the app to update, the service worker must change and recache the assets.  Changing this verions number will do that.
const version = "0.2"
const static_cache_name = 'static_assets-' + version;


self.addEventListener('install', e => e.waitUntil((async () => {
	const static_assets = await caches.open(static_cache_name);

	await static_assets.addAll([
		// Main page
		'/',
		'index.html',

		// 'app.webmanifest',

		// Favicons
		// 'icons/logo-opt.svg',
		// 'icons/logo-180.png',

		// Styles
		'style/index.css',

		'js/index.mjs',
		'js/lib.mjs',

		// Extern libraries
		'extern/JsBarcode.all.min.js',
		'extern/qrcode_UTF8.js',
		'extern/qrcode-generator.js'
	]);

	await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
	await clients.claim(); // Claim all the active pages.

	const keys = await caches.keys();
	keys.splice(keys.indexOf(static_cache_name));

	await Promise.all(keys.map(k => caches.delete(k)));
})()));

self.addEventListener('fetch', e => {
	e.respondWith(
		caches.match(e.request).then(res => res || fetch(e.request))
	);
});
