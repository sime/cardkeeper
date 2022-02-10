import { wait, defered } from './lib.mjs';
import { Card } from './card.mjs';
import { mount, html, on } from './templating.mjs';
import onboarding from './onboarding.mjs';

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
						if (card.color) {
							e.style.setProperty('--card-color', card.color);
						}
					}}>
						<h2>${card.name}</h2>
						<p>${card.rawValue}</p>
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
async function edit_card(card, image = null) {
	let form;
	let t_save_card, t_delete_card;
	mount(html`
	<h2>Edit Card</h2>
	<div>
		${() => {
			if (card.format === 'qr_code') {
				// Only output the rawvalue for qrcodes because the barcodes embed the value in their image.
				return html`<output>${card.rawValue}</output>`;
			}
		}}
		<span>${image}<span>
	</div>
	<form ${e => {form = e}}>
		<label>
			Give the card a name:<br>
			<input name="name" type="text" ${e => {e.value = card.name}}>
		</label>
		<fieldset>
			<legend>Choose a colour</legend>
			${["#fa5252", "#e64980", "#be4bdb", "#4c6ef5", "#228be6", "#15aabf", "#12b886", "#40c057"].map(color => html`
				<input name="color" type="radio" ${e => {
					if (color == card.color) e.checked = true;
					e.value = color;
				}}>
			`)}
		</fieldset>

		<div class="spacer"></div>
		
		<div class="space-between">
			<button ${e => {
				t_delete_card = new Promise(resolve => {
					on('click', ev => {
						ev.preventDefault();
						card.delete();
						resolve();
					})(e);
				});
			}}>Delete</button>
			<button ${e => {
				t_save_card = new Promise(resolve => {
					on('click', ev => {
						ev.preventDefault();
						const data = new FormData(form);
						card.name = data.get('name');
						card.color = data.get('color');
						card.save();
						resolve();
					}, {once: true})(e);
				});
			}}>Save</button>
		</div>
	</form>`);
	await Promise.race([t_save_card, t_delete_card]);
}

// Display card view
async function view_card(card) {	
	const canvas = document.createElement('canvas');
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
	if (supported_barcode_formats.includes(card.format)) {
		// Convert between browser format names and JsBarcode names:
		let format = card.format.toUpperCase();
		format = format.replace('_', '');
		if (format == 'ITF') {
			format = 'ITF14'
		} else if (format == 'UPCA') {
			format = 'UPC';
		}
		JsBarcode(canvas, card.rawValue, { format });
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
	<button ${e => {
		t_back = wait(e, 'click');
	}}>&lt; Back</button>
	${canvas}
	<p>${card.name}</p>
	<p>${card.rawValue}</p>

	<button ${e => {
		t_edit_card = wait(e, 'click').then(_ => 
			edit_card(card, canvas)
		);
	}}>Edit</button>
	`);

	await Promise.race([t_edit_card, t_back]);
}

// Add card view
async function add_card() {
	let quit = false;
	
	let switch_camera = true;
	let deviceId = '';

	const video = document.createElement('video');

	if (!('BarcodeDetector' in window)) {
		throw new Error("BarcodeDetector unsupported");
	}
	const detector = new BarcodeDetector();

	let canvas, ctx;
	mount(html`
		<button ${on('click', () => {quit = true})}>&lt; Back</button>
		<button ${on('click', () => {switch_camera = true})}>sc</button>
		<canvas ${e => {
			canvas = e;
			ctx = e.getContext('2d');
		}}></canvas>
		<p>Place the barcode in front of the camera</p>
	`);

	let barcode, track;
	while (!quit && !barcode) {
		if (switch_camera) {
			if (track) {
				track.stop();
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
			console.log(deviceId);
			const vid_settings = track.getSettings();
			canvas.width = vid_settings.width;
			canvas.height = vid_settings.height;
		}


		ctx.drawImage(video, 0, 0);

		// TODO: draw last_found (Would be inaccurate since it was from the last image...)
		// TODO: Stacked canvases? One just for drawing bounding box / cornerPoints?

		try {
			// STATE: detect
			// const barcodes = await detector.detect(bitmap);
			const barcodes = await detector.detect(canvas);
			if (barcodes.length > 0) {
				console.log(barcodes);
			}
			if (barcodes.length == 1) {
				barcode = barcodes[0];

				// Crop the canvas to the bounding box of the found barcode.  We'll use this image in the edit screen.
				const {x: sx, y: sy, width, height} = barcode.boundingBox;
				const bitmap = await createImageBitmap(canvas, sx, sy, width, height);
				canvas.width = width;
				canvas.height = height;
				ctx.drawImage(bitmap, 0, 0);
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
	if (track) {
		track.stop();
		video.pause();
	}
	if (!quit) {
		// Create the barcode
		const card = new Card(barcode);
		await edit_card(card, canvas);
	}
}