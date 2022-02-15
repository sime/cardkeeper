import { wait } from './lib.mjs';
import { Card } from './card.mjs';
import { mount, save, html, on } from './templating.mjs';
import onboarding from './onboarding.mjs';


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
						<p>${format_rawValue(card)}</p>
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

// Edit card view
async function edit_card(card, is_new = false) {
	let form;
	let t_save_card, t_delete_card;
	let card_preview;
	// TODO: Only show the "New Card Saved!" message if we are editing a new card.
	mount(html`
	${() => is_new ? html`<p class="saved-notif">New Card Saved!</p>` : null}
	<div class="card-preview" ${e => {card_preview = e}}>
		${format_rawValue(card)}
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
	await Promise.race([t_save_card, t_delete_card]);
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
	if (supported_barcode_formats.includes(card.format)) {
		// Convert between browser format names and JsBarcode names:
		let format = card.format.toUpperCase();
		format = format.replace('_', '');
		if (format == 'ITF') {
			format = 'ITF14'
		} else if (format == 'UPCA') {
			format = 'UPC';
		}
		JsBarcode(canvas, card.rawValue, { format, displayValue: false, textPosition: "top" });
	} else if (card.format == "qr_code") {
		const ctx = canvas.getContext('2d');
		const code = qrcode(0, 'M');
		code.addData(card.rawValue);
		code.make();
		const cell_size = 10;
		canvas.width = cell_size * code.getModuleCount();
		canvas.height = cell_size * code.getModuleCount();
		// What should cell size be?
		code.renderTo2dContext(ctx, cell_size);

		// Use QR code generation library
	} else {
		throw "unsupported format";
	}

	
	let t_edit_card, t_back;
	mount(html`
	<button class="cancel-btn" ${e => {
		t_back = wait(e, 'click');
	}}>Back</button>
	<div class="card-display">
		${canvas}
		<h2>${card.name}</h2>
		<p>${format_rawValue(card)}</p>
	</div>

	<button ${e => {
		t_edit_card = wait(e, 'click').then(_ => 
			edit_card(card)
		);
	}}>Edit Card <img src="/assets/edit-icon.svg"></button>
	`);

	await Promise.race([t_edit_card, t_back]);
}

// Add card view
async function add_card() {
	let quit = false;
	
	let switch_camera = true;
	let deviceId = '';

	const video = document.createElement('video');
	video.classList.add('image-capture');

	if (!('BarcodeDetector' in window)) {
		throw new Error("BarcodeDetector unsupported");
	}
	const detector = new BarcodeDetector();

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

			// video = document.createElement('video');
			video.srcObject = stream;
			await video.play();

			// Set the camera's properties (width / height) to the canvas
			// MAYBE: Get the width / height from the video element?
			track = stream.getVideoTracks()[0];
			if (!track) {
				throw new Error("No video track in the stream!");
			}
			deviceId = track.getSettings().deviceId;
			// console.log(deviceId);
			// const vid_settings = track.getSettings();
			// canvas.width = vid_settings.width;
			// canvas.height = vid_settings.height;
		}


		// ctx.drawImage(video, 0, 0);
		// TODO: draw last_found (Would be inaccurate since it was from the last image...)
		// TODO: Stacked canvases? One just for drawing bounding box / cornerPoints?

		try {
			// STATE: detect
			// const barcodes = await detector.detect(bitmap);
			const barcodes = await detector.detect(video);
			if (barcodes.length > 0) {
				console.log(barcodes);
			}
			if (barcodes.length == 1) {
				barcode = barcodes[0];

				// Crop the canvas to the bounding box of the found barcode.  We'll use this image in the edit screen.
				// const {x: sx, y: sy, width, height} = barcode.boundingBox;
				// const bitmap = await createImageBitmap(canvas, sx, sy, width, height);
				// canvas.width = width;
				// canvas.height = height;
				// ctx.drawImage(bitmap, 0, 0);
			} else if (barcodes.length > 1) {
				// TODO: Set last_found and skip.
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
	if (!quit) {
		// Create the barcode
		const card = new Card(barcode);
		await edit_card(card, true);
	}
}