import { Card } from './card.mjs';
import { mount, save, html, on } from './templating/index.mjs';
import onboarding from './onboarding.mjs';
import { machine, SkipTransition } from './lib/machine.mjs';
import { signal, use, use_later } from './reactivity.mjs';
import { text } from './templating/expressions.mjs';


const zxing_prom = ZXing();

const card_colors = [
	{ name: "Blue",   disp: "#608DFF", value: "#0031AF" },
	{ name: "Purple", disp: "#D9A7FF", value: "#681CA2" },
	{ name: "Pink",   disp: "#FFB9EB", value: "#A82783" },
	{ name: "Golden", disp: "#FFD056", value: "#B8992B" },
	{ name: "Green",  disp: "#C1FF90", value: "#4D871F" },
	{ name: "Teal",   disp: "#92DEFF", value: "#1A779F" },
	{ name: "Red",    disp: "#FE8D8D", value: "#A70E0E" },
	{ name: "Brown",  disp: "#FFAC7D", value: "#96491F" },
	{ name: "Lime",   disp: "#E8F34F", value: "#696E1C" },
	{ name: "Tosca",  disp: "#78F4C7", value: "#2B8665" },
];
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
const t_sw_update = new Promise(resolve => {
	// I sometimes use an http dev server
	if ('serviceWorker' in navigator) {
		// TODO: use ServiceWorkerRegistration.onupdatefound instead?
		let last_controller = navigator.serviceWorker.controller;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (last_controller) resolve();
			last_controller = navigator.serviceWorker.controller;
		});
	} else {
		console.error("no service worker support.");
	}
});
// Setup service worker
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js');
	});
}

// Run the app:
try {
	card_keeper();
} catch (e) {
	console.error(e);
}

// Root view
async function card_keeper() {
	const {state, transition} = machine();
	while(true) {
		const cards = Card.get_cards();

		if (cards.length == 0) {
			await onboarding();
			await add_card();
		} else {
			mount(html`
				<h1>Card Keeper</h1>
				<ul class="card-list" ${on('click', transition('view_card', ({target}) => {
					const card_id = target.closest('li')?.dataset['cardid'];
					if (!card_id) return SkipTransition;
					return new Card(card_id);
				}))}>
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
				</ul>
				<button ${on('click', transition('add_card'), {once: true})}>
					Add Card
					<img width="28" height="28" src="/assets/button-plus.svg">
				</button>
			`);

			const result = await state(['view_card', 'add_card'], t_sw_update.then(() => 'update'));

			if (result == 'update') {
				location.reload();
				break;
			} else if (result instanceof Card) {
				await view_card(result);
			} else {
				await add_card();
			}
		}
	}
}

class ZXBarcodeDetector {
	canvas = document.createElement('canvas');
	ctx = this.canvas.getContext('2d');
	cpp_buffer = null;
	free() {
		zxing_prom.then(zxing => {
			zxing._free(this.cpp_buffer);
			this.cpp_buffer = null;
		});
	}
	async detect(source) {
		const zxing = await zxing_prom;

		if (source.videoWidth === 0 || source.videoHeight === 0) {
			return [];
		} else if (source.videoWidth !== this.canvas.width) {
			this.canvas.width = source.videoWidth;
			this.canvas.height = source.videoHeight;
			if (this.cpp_buffer) {
				this.free();
			}
		}
		this.ctx.drawImage(source, 0, 0);

		const img_data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
		if (this.cpp_buffer === null) {
			this.cpp_buffer = zxing._malloc(img_data.data.length);
		}
		// Copy the img_data into the cpp_buffer
		zxing.HEAPU8.set(img_data.data, this.cpp_buffer);

		// TODO: Ask ZXing to find a barcode.
		let result = zxing.readBarcodeFromPixmap(
			this.cpp_buffer, // Buffer Pointer
			img_data.width,  // Width
			img_data.height, // Height
			true,            // TryHarder (Try to find barcodes in flipped / rotate images I think)
			''               // Barcode format to look for: an empty string means look for anything.
		)

		if (result.error) {
			throw new Error(result.error);
		}
		if (result.format) {
			return [{
				format: result.format,
				rawValue: result.text
			}];
		} else {
			return [];
		}
	}
}

// Edit card view
async function edit_card(card, is_new = false) {
	const {state, transition} = machine();

	const [name, set_name] = signal(card.name);
	const [color, set_color] = signal(card.color);

	let card_preview;
	mount(html`
	<button class="cancel-btn" ${on('click', transition('cancel', () => {
		if (is_new) card.delete();
	}), {once: true})}>
		<svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M15.8335 10.5L4.16683 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			<path d="M10 16.3335L4.16667 10.5002L10 4.66683" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		Cancel
	</button>
	${is_new ? html`<p class="saved-notif">New Card Saved!</p>` : null}
	<div class="card-preview" ${use_later(el => {
		el.style.backgroundColor = card_colors[color()].value;
	})}>
		<span class="card-data">
			${format_rawValue(card)}
		</span>
	</div>
	<label for="card-name">Card Name:</label>
	<input type="text" id="card-name" value="${name()}" placeholder="Name your card" ${on('change', ({target}) => set_name(target.value))}>
	<label for="card-color">Card Colour:</label>
	<button id="card-color" ${[
		use_later(e => e.style.setProperty('--swatch-color', card_colors[color()].disp)),
		on('click', async () => {
			let t = save();
			set_color(await color_picker(color()));
			mount(t);
		})
	]}>${text(use_later(t => t.data = card_colors[color()].name))}</button>
	<div class="filler"></div>
	<div class="btn-group">
		<button class="icon-btn" ${on('click', transition('delete', () => card.delete()), {once: true})}>
			<img src="/assets/trash.svg">
			</button>
		<button ${on('click', transition('save', () => {
			card.color = color();
			card.name = name();
			card.save();
		}))}>Save Card</button>
	</div>`);
	await state(['cancel', 'delete', 'save']);
}

async function color_picker(initial_color_index) {
	const {state, transition} = machine();

	const [color, set_color] = signal(initial_color_index);

	mount(html`
		<button class="cancel-btn" ${on('click', transition('done', () => color()), {once: true})}>
			<svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M15.8335 10.5L4.16683 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M10 16.3335L4.16667 10.5002L10 4.66683" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			Done
		</button>
		<div class="color-preview" ${use_later(e => {
			e.style.setProperty('--picker-color', card_colors[color()].value);
		})}></div>
		<fieldset class="color-picker" ${on('change', ({target}) => set_color(target.value))}>
			<legend>Select Card Colour</legend>
			${card_colors.map((c, i) => html`
				<input name="color_index" type="radio" ${e => {
					if (i == initial_color_index) e.checked = true;
					e.value = i;
					e.style.setProperty('--picker-color', c.disp);
				}}>
			`)}
		</fieldset>
	`);
	return await state(['done']);
}

// Display card view
async function view_card(card) {
	const {state, transition} = machine();

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	// TODO: Make these scale for barcodes with more data?  Or maybe make it the Min(device width, device height)?

	mount(html`
	<button class="cancel-btn" ${on('click', transition('cancel'))}>
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

	<button ${on('click', transition('edit'), {once: true})}>Edit Card <img src="/assets/edit-icon.svg"></button>
	`);

	const zxing = await zxing_prom;

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

	const result = await state(['cancel', 'edit']);
	if (result == 'edit') {
		await edit_card(card);
	}
}

// Add card view
async function add_card() {
	let quit = false;
	
	let switch_camera = true;
	let deviceId = '';

	const video = document.createElement('video');
	video.classList.add('image-capture');

	const detector = ('BarcodeDetector' in window) ? new BarcodeDetector() : new ZXBarcodeDetector();

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
		<img class="capture-overlay" src="/assets/camera-overlay.svg">
		<p class="capture-status">Place barcode inside the area</p>
	`, "capture");

	let barcode, track;
	while (!quit && !barcode) {
		if (switch_camera) {
			if (track) track.stop();
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
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: video_constraints,
					audio: false
				});
			} catch (e) {
				alert("Failed to get camera access");
				return;
			}

			video.srcObject = stream;
			await video.play();

			// Set the camera's properties (width / height) to the canvas
			// MAYBE: Get the width / height from the video element?
			track = stream.getVideoTracks()[0];
			if (!track) {
				throw new Error("No video track in the stream!");
			}
			deviceId = track.getSettings().deviceId;
		}

		try {
			// Rate limit detection to at most once per frame
			await new Promise(resolve => requestAnimationFrame(resolve));

			// STATE: detect
			const barcodes = await detector.detect(video);
			if (barcodes.length > 0) {
				barcode = barcodes[0];
			}
		} catch (e) {
			if (e.name === 'NotSupportedError') {
				throw new Error("Barcode Detection isn't supported");
			} else {
				throw e;
			}
		}
	}
	if (track) track.stop();
	video.pause();

	// Used by the zxing detector to free the cpp image buffer
	if (detector.free) detector.free();
	
	if (barcode) {
		// Create the barcode
		const card = new Card(barcode);
		await edit_card(card, true);
	}
}