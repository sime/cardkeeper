import { Card } from './card.mjs';
import { mount, save, html, on } from './templating/index.mjs';
import onboarding from './onboarding.mjs';


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
	while(true) {
		const cards = Card.get_cards();
		let update = false;

		if (cards.length == 0) {
			// STATE: onboarding, TRANSITIONS: [onboarding_done]
			await onboarding();

			await add_card();
		} else {
			let t_add_card, t_view_card;
			mount(html`
				<h1>Card Keeper</h1>
				<ul class="card-list" ${e => {
					t_view_card = new Promise(resolve => {
						function click_handler(ev) {
							const card_el = ev.target.closest('li');
							const card_id = card_el?.dataset['cardid'];
							if (card_id) {
								resolve(new Card(card_id));
								e.removeEventListener('click', click_handler);
							}
						}
						e.addEventListener('click', click_handler);
					}).then(c => view_card(c));
				}}>
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
				<button ${e => {
					t_add_card = new Promise(resolve => {
						on('click', resolve, {once: true})(e);
					}).then(_ => add_card());
				}}>Add Card <img width="28" height="28" src="/assets/button-plus.svg"></button>
			`);

			await Promise.race([t_view_card, t_add_card, t_sw_update.then(_ => update = true)]);

			if (update) {
				location.reload();
				break;
			}
		}
	}
}

class ZKBarcodeDetector {
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
	let t_save_card, t_delete_card, t_cancel;
	let card_preview;
	mount(html`
	<button class="cancel-btn" ${e => {
		t_cancel = new Promise(resolve => {
			e.addEventListener('click', () => {
				if (is_new) card.delete();
				resolve();
			}, {once: true});
		});
	}}>
		<svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M15.8335 10.5L4.16683 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			<path d="M10 16.3335L4.16667 10.5002L10 4.66683" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		Cancel
	</button>
	${() => is_new ? html`<p class="saved-notif">New Card Saved!</p>` : null}
	<div class="card-preview" ${e => {card_preview = e}}>
		<span class="card-data">
			${format_rawValue(card)}
		</span>
	</div>
	<label for="card-name">Card Name:</label>
	<input type="text" id="card-name" placeholder="Name your card" ${e => {
		if (card.name != "") {
			e.value = card.name;
		}
		e.addEventListener('change', () => {
			card.name = e.value;
		});
	}}>
	<label for="card-color">Card Colour:</label>
	<button id="card-color" ${e => {
		const update = () => {
			const color = card_colors[card.color];
			e.style.setProperty('--swatch-color', color.disp);
			e.innerText = color.name;
			card_preview.style.backgroundColor = color.value;
		};
		e.addEventListener('click', async ev => {
			ev.preventDefault();
			e.blur();
			let t = save();
			card.color = await color_picker(card.color);
			mount(t);
			update();
		});
		update();
	}}></button>
	<div class="filler"></div>
	<div class="btn-group">
		<button class="icon-btn" ${e => {
			t_delete_card = new Promise(resolve => {
				e.addEventListener('click', () => {
					card.delete();
					resolve();
				}, {once: true});
			});
		}}><img src="/assets/trash.svg"></button>
		<button ${e => {
			t_save_card = new Promise(resolve => {
				e.addEventListener('click', () => {
					card.save();
					resolve();
				}, {once: true});
			});
		}}>Save Card</button>
	</div>`);
	await Promise.race([t_cancel, t_save_card, t_delete_card]);
}

async function color_picker(initial_color_index) {
	let t_cancel, t_save;
	let color = initial_color_index;
	let preview;
	mount(html`
		<button class="cancel-btn" ${e => {
			t_cancel = new Promise(resolve => {
				e.addEventListener('click', () => {
					resolve(initial_color_index);
				}, {once: true});
			});
		}}>
			<svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M15.8335 10.5L4.16683 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M10 16.3335L4.16667 10.5002L10 4.66683" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			Cancel
		</button>
		<div class="color-preview" ${e => {
			preview = e;
			e.style.setProperty('--picker-color', card_colors[color].value);
		}}></div>
		<fieldset class="color-picker" ${e => {
			e.addEventListener('change', ev => {
				color = ev.target.value;
				preview.style.setProperty('--picker-color', card_colors[color].value);
			});
		}}>
			<legend>Select Card Colour</legend>
			${card_colors.map((c, i) => html`
				<input name="color_index" type="radio" ${e => {
					if (i == initial_color_index) e.checked = true;
					e.value = i;
					e.style.setProperty('--picker-color', c.disp);
				}}>
			`)}
		</fieldset>
		<div class="btn-group">
			<button ${e => {
				t_save = new Promise(resolve => {
					e.addEventListener('click', () => {
						resolve(color);
					}, {once: true});
				});
			}}>Save Colour</button>
		</div>
	`);
	return await Promise.race([t_cancel, t_save]);
}

// Display card view
async function view_card(card) {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	// TODO: Make these scale for barcodes with more data?  Or maybe make it the Min(device width, device height)?

	let t_edit_card, t_back;
	mount(html`
	<button class="cancel-btn" ${e => {
		t_back = new Promise(res => on('click', res, {once: true})(e));
	}}>
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

	<button ${e => {
		t_edit_card = new Promise(res => on('click', res, {once: true})(e)).then(_ => 
			edit_card(card)
		);
	}}>Edit Card <img src="/assets/edit-icon.svg"></button>
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

	await Promise.race([t_edit_card, t_back]);
}

// Add card view
async function add_card() {
	let quit = false;
	
	let switch_camera = true;
	let deviceId = '';

	const video = document.createElement('video');
	video.classList.add('image-capture');

	const detector = ('BarcodeDetector' in window) ? new BarcodeDetector() : new ZKBarcodeDetector();

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

			const stream = await navigator.mediaDevices.getUserMedia({
				video: video_constraints,
				audio: false
			});

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