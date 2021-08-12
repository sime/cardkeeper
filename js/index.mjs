import { wait } from './lib.mjs';

const scenes = {
	card_capture: document.getElementById('scene-card-capture').content,
	card_edit: document.getElementById('scene-card-edit').content,
	card_view: document.getElementById('scene-card-view').content,
	// TODO: entry scene / card list
};

const main = document.querySelector('main');

async function card_keeper() {
	while(true) {

		const add_card = main.querySelector('button.add-card');
	
		// TODO: Display cards if we have any, and also update the add card button text
	
		// STATE: wait_for_add_card
		await wait(add_card, 'click');
	
		// Request access to the user's camera
		const t_camera_perm = navigator.mediaDevices.getUserMedia({
			video: { facingMode: "environment" },
			audio: false
		});
	
		// Load the capture scene
		main.innerHTML = "";
		main.appendChild(document.importNode(scenes.card_capture, true));
		// Get elements from the card_capture scene
		const canvas = main.querySelector('canvas');
		const back_btn = main.querySelector('button.back');
	
		// STATE: wait_for_camera
		const stream = await t_camera_perm;
		const video = document.createElement('video');
		video.srcObject = stream;
	
		if (!('BarcodeDetector' in window)) {
			throw new Error("BarcodeDetector unsupported");
		}
		const detector = new BarcodeDetector({
			formats: [
				'aztec',
				'code_128',
				'code_39',
				'code_93',
				'codabar',
				'data_matrix',
				'ean_13',
				'ean_8',
				'itf',
				'pdf417',
				'qr_code',
				'upc_a',
				'upc_e'
			]
		})
		
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
			const bitmap = createImageBitmap(canvas);
	
			// TODO: draw last_found (Would be inaccurate since it was from the last image...)
			// TODO: Stacked canvases? One just for drawing bounding box / cornerPoints?
	
			try {
				// STATE: detect
				const barcodes = await detector.detect(bitmap);
				if (barcodes.length == 1) {
					barcode = barcodes[0];
				} else if (barcodes.length > 1) {
					// TODO: Set last_found and skip.
				}
			} catch (e) {
				if (e.name === 'NotSupportedError') {
					throw new Error("Barcode Detection isn't supported");
				}
			}
		}
	
		console.log(barcode);
	}
}
try {
	card_keeper();
} catch (e) {
	console.error(e);
}