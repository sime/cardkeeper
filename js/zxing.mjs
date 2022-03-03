export const zxing_prom = ZXing();

export class ZXBarcodeDetector {
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