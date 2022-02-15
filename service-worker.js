// This service worker will never refetch assets once it's installed the first time.  This means that in order for the app to update, the service worker must change and recache the assets.  Changing this verions number will do that.
const version = "0.2"
const static_cache_name = 'static_assets-' + version;

const offline_assets = [
	'/',
	'assets/button-arrow.svg',
	'assets/button-plus.svg',
	'assets/camera-overlay.svg',
	'assets/camera.svg',
	'assets/card-full.svg',
	'assets/card-half.svg',
	'assets/coffee-icon.svg',
	'assets/device-icon.svg',
	'assets/DMSans-Regular.ttf',
	'assets/edit-icon.svg',
	'assets/flip-camera-icon.svg',
	'assets/grocery-icon.svg',
	'assets/gym-icon.svg',
	'assets/library-icon.svg',
	'assets/offline-icon.svg',
	'assets/onboard1.svg',
	'assets/onboard2.svg',
	'assets/select-icon.svg',
	'assets/trash.svg',
	'extern/JsBarcode.all.min.js',
	'extern/qrcode_UTF8.js',
	'extern/qrcode-generator.js',
	'index.html',
	'js/card.mjs',
	'js/create-template.mjs',
	'js/descendant-path.mjs',
	'js/lib.mjs',
	'js/index.mjs',
	'js/onboarding.mjs',
	'js/templating.mjs',
	'style/index.css',
];


self.addEventListener('install', e => e.waitUntil((async () => {
	const static_assets = await caches.open(static_cache_name);

	await static_assets.addAll(offline_assets);

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
		caches.match(e.request).then(res => res || fetch(e.request)).catch(e => console.error(e))
	);
});
