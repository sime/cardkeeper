import { wait, defered } from './lib.mjs';

const main = document.querySelector('main');

function swap_scene(id, className = "") {
	const template = document.getElementById('scene-' + id);
	// Remove old contents:
	while (main.firstChild) {
		main.firstChild.remove();
	}

	// Insert the new contents
	main.appendChild(document.importNode(template.content, true));

	// add the overlay
	main.className = className;
}

class Card {
	constructor(idOrBarcode) {
		if (typeof idOrBarcode == 'string') {
			const {format, rawValue, name, color} = JSON.parse(localStorage.getItem(idOrBarcode));
			this.format = format;
			this.rawValue = rawValue;
			this.name = name;
			this.color = color;
			this.id = idOrBarcode;
		} else if (typeof idOrBarcode == 'object') {
			// TODO: check if we've already created this card.  If so, then link them up.
			this.id = Card.make_id();
			this.format = idOrBarcode.format;
			this.rawValue = idOrBarcode.rawValue;
			this.name = "[new card]";
			this.color = false;
			this.save();
		} else {
			throw "";
		}
	}
	make_card() {
		const btn = document.createElement('button');
		btn.innerText = this.name;
		// TODO: add something that creates contrasting colors for the text.
		btn.style.backgroundColor = this.color;
		btn.dataset['cardid'] = this.id;

		return btn;
	}
	save() {
		localStorage.setItem(this.id, JSON.stringify(this));
	}
	delete() {
		localStorage.removeItem(this.id);
	}
	static make_id() {
		let id_gen = localStorage.getItem('card-id-gen');
		if (id_gen !== null) {
			id_gen = Number.parseInt(id_gen);
		} else {
			id_gen = 0;
		}
		const id = id_gen + 1;
		localStorage.setItem('card-id-gen', id);
		return 'card.' + id;
	}
	static get_cards() {
		// Get all the local storage keys and filter them to the cards (which start with card)
		const count = localStorage.length;
		const cards = [];
		for (let i = 0; i < count; ++i) {
			const key = localStorage.key(i);
			if (key.startsWith('card.')) {
				cards.push(new Card(key));
			}
		}
		return cards;
	}
}

async function edit_card(card, image = false) {
	swap_scene('card-edit');
	const form = main.querySelector('form');

	main.querySelector('input[name="name"]').value = card.name;

	// TODO: Make sure this isn't an injection problem.
	if (card.color) {
		const col_el = main.querySelector(`input[value="${card.color}"]`);
		if (col_el) {
			col_el.checked = true;
		}
	}

	main.querySelector('output').innerText = card.rawValue;

	if (image !== false) {
		main.querySelector('img').replaceWith(image);
	}

	const t_save_card = wait(form, 'submit').then(ev => {
		ev.preventDefault();
		const data = new FormData(form);
		card.name = data.get('name');
		card.color = data.get('color');
		card.save();
	});
	const t_delete_card = wait(main.querySelector('#delete'), 'click').then(e => {
		e.preventDefault();
		card.delete();
	});
	await Promise.race([t_save_card, t_delete_card]);
}

async function card_keeper() {
	while(true) {
		swap_scene('home');

		const add_card = main.querySelector('button.add-card');

		const card_list = main.querySelector('#card-list');
		const cards = Card.get_cards();
		if (cards.length > 0) {
			main.querySelector('#description').remove();
			add_card.innerText = "Add card";
			// TODO: Check if we have camera permission before removing the perm warning
			main.querySelector('#perm-warning').remove();


			// Display the cards
			for (const card of cards) {
				card_list.appendChild(card.make_card());
				// TODO: handle viewing the card
			}
		}

		const t_view_card = wait(card_list, 'click').then(async ev => {
			const card = new Card(ev.target.dataset['cardid']);
			swap_scene('card-view');
			// TODO: Generate the barcode
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
			main.querySelector('img').replaceWith(canvas);
			main.querySelector('#name').innerText = card.name;
			main.querySelector('#rawValue').innerText = card.rawValue;

			const t_edit_card = wait(main.querySelector('#edit'), 'click').then(_ => 
				edit_card(card, canvas)
			);
			const t_back = wait(main.querySelector('#back'), 'click');

			await Promise.race([t_edit_card, t_back]);
		});
		const t_add_card = wait(add_card, 'click').then(async _ => {
			// Load the capture scene
			swap_scene('card-capture', 'backdrop');
			// Get elements from the card_capture scene
			const canvas = main.querySelector('canvas');
			const back_btn = main.querySelector('button.back');
			const sc_btn = main.querySelector('button.sc');

			let quit = false;
			wait(back_btn, 'click').then(_ => quit = true);
			
			let switch_camera = true;
			let deviceId = '';

			const video = document.createElement('video');
		
			if (!('BarcodeDetector' in window)) {
				throw new Error("BarcodeDetector unsupported");
			}
			const detector = new BarcodeDetector();
		
			const ctx = canvas.getContext('2d');
		
			let last_found = [];
			let barcode, track;
			while (!quit && !barcode) {
				if (switch_camera) {
					if (track) {
						track.stop();
					}
					wait(sc_btn, 'click').then(_ => switch_camera = true);
					switch_camera = false;

					let video_constraints = {
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
					deviceId = track.getSettings().deviceId;
					console.log(deviceId);
					if (!track) {
						throw new Error("No video track in the stream!");
					}
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
			if (!quit) {
				// Create the barcode
				const card = new Card(barcode);
				await edit_card(card, canvas);
			}
		});

		// STATE: home_screen
		await Promise.race([t_view_card, t_add_card]);
	}
}
try {
	card_keeper();
} catch (e) {
	console.error(e);
}