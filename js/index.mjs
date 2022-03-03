import { Card } from './card.mjs';
import { mount, save, html, on } from './templating/index.mjs';
import onboarding from './onboarding.mjs';
import { signal, use_later } from './reactivity.mjs';
import { text } from './templating/expressions.mjs';
import { card_colors } from './card-colors.mjs';
import { zxing_prom, ZXBarcodeDetector } from './zxing.mjs';

// a list of formats is: https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API#supported_barcode_formats
const supported_barcode_formats = [
	'code_128',
	'code_39',
	'ean_13',
	'ean_8',
	'itf',
	'upc_a',
	'upc_e'
];
function format_rawValue(card) {
	let prefix = "";
	if (supported_barcode_formats.includes(card.format)) {
		prefix = "#";
	}
	return new Text(prefix + card.rawValue);
}

// This transition occurs when a new service worker claims the page.
let has_update = false;

if ('serviceWorker' in navigator) {
	// TODO: use ServiceWorkerRegistration.onupdatefound instead?
	let last_controller = navigator.serviceWorker.controller;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (last_controller) has_update = true;
		last_controller = navigator.serviceWorker.controller;
	});

	// Setup service worker
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js');
	});
} else {
	console.error("no service worker support.");
}

const [installPromptEvent, set_installPromptEvent] = signal(false);
window.addEventListener('beforeinstallprompt', e => {
	e.preventDefault();
	set_installPromptEvent(e);
}, {once: true});
function update_backoff(response = "dismissed") {
	if (response == "accepted") {
		localStorage.removeItem('install-prompt');
	} else {
		const last_try = localStorage.getItem('install-prompt');
		let new_delay = 1;
		if (last_try) {
			const {delay} = JSON.parse(last_try);
			new_delay = delay * (1 + Math.sqrt(5)) / 2;
		}
		localStorage.setItem('install-prompt', JSON.stringify({
			date: Date.now(),
			delay: new_delay
		}));
	}
}
function backoff_is_up() {
	const last_try = localStorage.getItem('install-prompt');
	if (last_try) {
		let {date, delay} = JSON.parse(last_try);
		date = new Number(date);
		delay = new Number(delay);
		const diff = Date.now() - date;
		return diff > 24 * 60 * 60 * 1000 * delay;
	} else {
		return true;
	}
}


/**
 * Navigation states:
 * list-view (onboarding is just the list-view when no cards are currently saved) [/]:
 * - add button -> push state: add-card
 * - tap card -> push state: view-card
 * add-card [/add-card/]:
 * - scan card -> replace state: edit-card
 * - back button -> pop state
 * view-card [/view-card/?id=<card-id>]:
 * - edit button -> ?replace state?: edit-card
 * - back button -> pop state
 * edit-card (color picker isn't a separate page) [/edit-card/?id=<card-id>]:
 * - save button -> pop state
 * - delete button -> pop state
 * - back button -> pop state
 */
window.onpopstate = () => {
	setTimeout(card_keeper, 0);
};
card_keeper();

function card_keeper() {
	const path = window.location.pathname;
	if (path == '/' || path == '') /* List View */ {
		list_cards();
	} else if (path == '/add-card/') /* Add Card */ {
		add_card();
	} else if (path == '/view-card/') /* View Card */ {
		view_card();
	} else if (path == '/edit-card/') /* Edit Card */ {
		edit_card();
	} else {
		console.error(new Error("Unknown view"));
	}
}

function list_cards() {
	// Reload the page if there's an update
	if (has_update) {
		window.location.reload();
	}
	
	const cards = Card.get_cards().sort((a, b) => {
		a = a.name.toLowerCase();
		b = b.name.toLowerCase();
		if (a < b) {
			return -1;
		} else if (a > b) {
			return 1;
		} else {
			return 0;
		}
	});

	if (cards.length == 0) {
		// TODO: onboarding
		onboarding().then(() => {
			history.pushState({}, '', '/add-card/');
			add_card();
		});
	} else {
		mount(html`
			<h1>Card Keeper</h1>
			<ul class="card-list" ${on('click', ({target}) => {
				const card_id = target.closest('li')?.dataset['cardid'];
				if (card_id) {
					window.history.pushState({}, '', `/view-card/?id=${card_id}`);
					view_card();
				}
			})}>
			${cards.map(card => html`
				<li ${e => {
					e.dataset['cardid'] = card.id;
					const color = card_colors[card.color];
					e.style.setProperty('--card-color', color.value);
				}}>
					<h2>${card.name}</h2>
					<p class="card-data">${format_rawValue(card)}</p>
				</li>
			`)}
			${use_later(e => {
				if (backoff_is_up() && cards.length >= 2 && installPromptEvent()) {
					e.replaceWith(html`
						<li class="install-prompt" ${e => {
							e.addEventListener('click', async () => {
								installPromptEvent().prompt();
								set_installPromptEvent(false);
								update_backoff(await installPromptEvent.userChoice);
								e.remove();
							});
						}}>
							<img src="/assets/install-icon.svg">
							Add App to Homescreen
							<button ${e => {
								e.addEventListener('click', ev => {
									ev.stopPropagation();
									e.parentNode.remove();
									update_backoff();
								}, {once: true});
							}}>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<g opacity="0.6">
										<path d="M18 6L6 18" stroke="#DFDFDF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
										<path d="M6 6L18 18" stroke="#DFDFDF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
									</g>
								</svg>
							</button>
						</li>`
					);
				}
			})}
			</ul>
			<button ${on('click', () => {
				window.history.pushState({}, '', '/add-card/');
				add_card();
			}, {once: true})}>
				Add Card
				<img width="28" height="28" src="/assets/button-plus.svg">
			</button>
		`);
	}
}

function edit_card() {
	const card_id = new URL(window.location).searchParams.get('id');
	let card;
	try {
		card = new Card(card_id);
	} catch {
		// If the card doesn't exist then just go back to the card list.
		history.replaceState({}, '', '/');
		list_cards();
		return;
	}

	const [name, set_name] = signal(card.name);
	const [color, set_color] = signal(card.color);

	async function pick_color() {
		let t = save();
		set_color(await color_picker(color()));
		mount(t);
	}

	mount(html`
	<button class="cancel-btn" ${on('click', () => {
		history.back();
	}, {once: true})}>
		<svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M15.8335 10.5L4.16683 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			<path d="M10 16.3335L4.16667 10.5002L10 4.66683" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		Cancel
	</button>
	<div class="card-preview" ${[
		on('click', pick_color),
		use_later(el => {
			el.style.backgroundColor = card_colors[color()].value;
	})]}>
		<span class="card-data">
			${format_rawValue(card)}
		</span>
	</div>
	<label for="card-name">Card Name:</label>
	<input type="text" id="card-name" value="${name()}" placeholder="Name your card" ${[
		on('change', ({target}) => set_name(target.value)),
		e => {if (card.name == '') {
			queueMicrotask(() => {
				// We have to do this in a microtask because the template isn't attached to the dom yet.
				e.focus();
			})
		}}
	]}>
	<label for="card-color">Card Colour:</label>
	<button id="card-color" ${[
		use_later(e => e.style.setProperty('--swatch-color', card_colors[color()].disp)),
		on('click', pick_color)
	]}>${text(use_later(t => t.data = card_colors[color()].name))}</button>
	<div class="filler"></div>
	<div class="btn-group">
		<button class="icon-btn" ${on('click', () => {
			if (window.confirm("Do you want to delete this card?")) {
				card.delete();
				history.back();
			}
		})}>
			<img src="/assets/trash.svg">
			</button>
		<button ${on('click', () => {
			card.color = color();
			card.name = name();
			card.save();
			history.back();
		})}>Save Card</button>
	</div>`);
}
function color_picker(initial_color_index) {
	return new Promise(resolve => {
		mount(html`
			<div class="color-preview" ${e => {
				e.style.setProperty('--picker-color', card_colors[initial_color_index].value);
			}}></div>
			<fieldset class="color-picker" ${on('change', ({target}) => resolve(target.value))}>
				<legend>Select Card Colour</legend>
				${card_colors.map((c, i) => html`
					<div>
						<input id="${`checkbox-${c.name}`}" name="color_index" type="radio" ${e => {
							if (i == initial_color_index) e.checked = true;
							e.value = i;
						}}>
						<label for="${`checkbox-${c.name}`}" ${e => e.style.setProperty('--picker-color', c.disp)}>
							${c.name}
						</label>
					</div>
				`)}
			</fieldset>
			<div class="spacer"></div>
		`);
	});
}

function view_card() {
	const card_id = new URL(window.location).searchParams.get('id');
	let card;
	try {
		card = new Card(card_id);
	} catch {
		// If the card doesn't exist then just go back to the card list.
		history.replaceState({}, '', '/');
		list_cards();
		return;
	}

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	mount(html`
	<button class="cancel-btn" ${on('click', () => {
		window.history.back();
	})}>
		<svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M15.8335 10.5L4.16683 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			<path d="M10 16.3335L4.16667 10.5002L10 4.66683" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		Back
	</button>
	<div class="card-display">
		${canvas}
		${() => {
			if (card.rawValue.length > 30) {
				return html`<details>
					<summary>${card.name}</summary>
					<p class="card-data no-clip">${format_rawValue(card)}</p>
				</details>`;
			} else {
				return html`
				<h2>${card.name}</h2>
				<p class="card-value no-clip">${format_rawValue(card)}</p>`;
			}
		}}
		
	</div>

	<button ${on('click', () => {
		window.history.replaceState({}, '', `/edit-card/?id=${card_id}`);
		edit_card();
	}, {once: true})}>Edit Card <img src="/assets/edit-icon.svg"></button>
	`);
	zxing_prom.then(zxing => {
		const res = zxing.generateBarcode(card.rawValue, card.format);
		if (res.error != '') {
			throw new Error(res.error);
		} else {
			const data = res.data;
			canvas.width = res.width;
			if (res.height == 1) {
				// Barcode
				const bar_height = canvas.height = canvas.width * 0.5;
				for (let x = 0; x < data.length; ++x) {
					if (data[x] === 0) {
						ctx.fillRect(x, 0, 1, bar_height);
					}
				}
			} else {
				canvas.height = res.height;
				// Expand the bw data to rgba and then put the image data into the canvas
				const expanded_data = new Uint8ClampedArray(data.length * 4);
				for (let i = 0; i < data.length; ++i) {
					// By default, typed arrays are filled with 0.  Which will be black with 0 opacity.  All we need to do is change the opacity to 1 for the bytes that are supposed to be black.
					expanded_data[i * 4 + 3] = data[i] ? 0 : 255;
				}
				ctx.putImageData(new ImageData(expanded_data, canvas.width), 0, 0);
			}
		}
	});
}

async function add_card() {
	let quit = false;
	
	let switch_camera = true;
	let deviceId = '';

	const video = document.createElement('video');
	video.classList.add('image-capture');

	const detector = ('BarcodeDetector' in window) ? new BarcodeDetector() : new ZXBarcodeDetector();

	const [track, set_track] = signal(false);

	mount(html`
		<div class="top-actions">
			<button class="cancel-btn" ${on('click', () => {quit = true})}>
				<svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M15.8335 10.5L4.16683 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					<path d="M10 16.3335L4.16667 10.5002L10 4.66683" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				Back
			</button>
			<button class="icon-btn sc-btn" ${on('click', () => {switch_camera = true})}><img src="/assets/flip-camera-icon.svg"></button>
		</div>
		<p class="camera-request">Requesting Camera Access...</p>
		${video}
		<svg xmlns="http://www.w3.org/2000/svg" class="capture-overlay" ${use_later(e => {
			if (track()) e.classList.add('active');
			else e.classList.remove('active');
		})}>
			<mask id="m1">
				<rect fill="white" width="100%" height="100%"/>
				<rect fill="black" rx="40" ry="40" x="50%" y="50%" width="260" height="260" transform="translate(-130, -130)"/>
			</mask>
			<rect mask="url(#m1)" fill="black" fill-opacity="0.6" width="100%" height="100%"/>
			<rect class="view-finder" rx="40" ry="40" x="50%" y="50%" width="260" height="260" transform="translate(-130, -130)"/>
			<style>
				@keyframes beat {
					from {
						stroke: transparent;
					}
					100% {
						stroke: red;
					}
				}
				.view-finder {
					fill: transparent;
				}
				.capture-overlay.active .view-finder {
					animation: beat 2s infinite alternate;
				}
			</style>
		</svg>

		<p class="capture-status">Place barcode inside the area</p>
	`, "capture");

	let barcode;
	while (!quit && !barcode) {
		try {
			if (switch_camera) {
				if (track()) {
					track().stop();
					set_track(false);
				}
				switch_camera = false;
	
				let video_constraints = {
					// The default constraints for the camera is to choose the back camera
					facingMode: "environment"
				};
				if (deviceId) {
					let devices = await navigator.mediaDevices.enumerateDevices();
					devices = devices.filter(d => d.kind == 'videoinput').map(d => d.deviceId);
					let cur_idx = devices.indexOf(deviceId);
					let next_idx = (cur_idx + 1) % devices.length;
					const id = devices[next_idx];
					video_constraints = {
						deviceId: {
							exact: id
						}
					};
				}
				let stream;
				try {
					stream = await navigator.mediaDevices.getUserMedia({
						video: video_constraints,
						audio: false
					});
				} catch (e) {
					throw new Error("Unable to get camera access");
				}
	
				video.srcObject = stream;
				await video.play();
	
				// Set the camera's properties (width / height) to the canvas
				// MAYBE: Get the width / height from the video element?
				set_track(stream.getVideoTracks()[0]);
				if (!track()) {
					throw new Error("No video track in the stream.");
				}
				deviceId = track().getSettings().deviceId;
			}
			// Rate limit detection to at most once per frame
			await new Promise(resolve => requestAnimationFrame(resolve));

			// STATE: detect
			const barcodes = await detector.detect(video);
			if (barcodes.length > 0) {
				barcode = barcodes[0];
			}
		} catch (e) {
			console.error(e);
			alert(e.toString());
			break;
		}
	}
	if (track()) track().stop();
	video.pause();

	// Used by the zxing detector to free the cpp image buffer
	if (detector.free) detector.free();
	
	if (barcode) {
		// Create the barcode
		const card = new Card(barcode);
		card.save();
		history.replaceState({}, '', `/edit-card/?id=${card.id}`);
		edit_card();
	}
}