import { wait, defered } from './lib.mjs';

const main = document.querySelector('main');

function swap_scene(id, overlay = false) {
	const template = document.getElementById('scene-' + id);
	// Remove old contents:
	while (main.firstChild) {
		main.firstChild.remove();
	}

	// Insert the new contents
	main.appendChild(document.importNode(template.content, true));

	// add the overlay
	if (overlay) {
		main.classList.add('overlay');
	} else {
		main.classList.remove('overlay');
	}
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
			this.color = "ffffff";
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
	swap_scene('card-edit', true);
	const form = main.querySelector('form');

	main.querySelector('input[name="name"]').value = card.name;
	// TODO: select the color (Should use a select instead of radio?)

	const img = main.querySelector('img');
	if (!image) {
		// TODO: generate the Barcode to display
	} else {
		img.src = image;
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

		const cards = Card.get_cards();
		const [card_opened, open_card] = defered();
		if (cards.length > 0) {
			main.querySelector('#description').remove();
			add_card.innerText = "Add card";
			// TODO: Check if we have camera permission before removing the perm warning
			main.querySelector('#perm-warning').remove();

			// Display the cards
			for (const card of cards) {
				const el = card.make_card();
				el.addEventListener('click', open_card.bind(null, card));
				main.appendChild(el);
				// TODO: handle viewing the card
			}
		}

		const t_view_card = card_opened.then(async card => {
			swap_scene('card-view');
			// TODO: Generate the barcode
			main.querySelector('#name').innerText = card.name;
			main.querySelector('#rawValue').innerText = card.rawValue;

			const t_edit_card = wait(main.querySelector('#edit'), 'click').then(_ => 
				edit_card(card)
			);
			const t_back = wait(main.querySelector('#back'), 'click');

			await Promise.race([t_edit_card, t_back]);
		});
		const t_add_card = wait(add_card, 'click').then(async _ => {
			// Request access to the user's camera
			const t_camera_perm = navigator.mediaDevices.getUserMedia({
				video: { facingMode: "environment" },
				audio: false
			});
		
			// Load the capture scene
			swap_scene('card-capture', true);
			// Get elements from the card_capture scene
			const canvas = main.querySelector('canvas');
			const back_btn = main.querySelector('button.back');
		
			// STATE: wait_for_camera
			const stream = await t_camera_perm;
			const video = document.createElement('video');
			video.srcObject = stream;
			await video.play();
		
			if (!('BarcodeDetector' in window)) {
				throw new Error("BarcodeDetector unsupported");
			}
			const detector = new BarcodeDetector();
			
			// Set the camera's properties (width / height) to the canvas
			// MAYBE: Get the width / height from the video element?
			const vid_track = stream.getVideoTracks()[0];
			if (!vid_track) {
				throw new Error("No video track in the stream!");
			}
			const vid_settings = vid_track.getSettings();
			canvas.width = vid_settings.width;
			canvas.height = vid_settings.height;
		
			const ctx = canvas.getContext('2d');
		
			let last_found = [];
			let barcode;
			while (!barcode) {
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
			// Create the barcode
			const card = new Card(barcode);
			await edit_card(card);
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