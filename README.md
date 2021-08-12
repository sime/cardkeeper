# Card Keeper: Loyalty/Membership card keeper
Application stores your membership cards, available offline.

User can retrieve membership numbers instantly,
avoiding the need to phicically carry them.

Retrieving the membership card shows an accurate representation
of the barcode which can be scanned at the merchant, e.g. coffee shops, fitness gyms, etc.

## Requirements:
* [ ] Reading barcodes
	* [ ] What kinds of cards are there?  Barcode, QR Code?... any others?
	* [ ] Should the image frames be processed in a/some web workers?
	* Getting images from the user's camera: ImageCapture API (Not supported in FF, or Safari)? It has a convenient grabFrame method though.
		* Alternative is just the normal render to canvas + extract bitmap method.
	* Should the preview be a video or just updated whenever we grab a frame?
		* I think it should just update when we grab a frame so that the user knows ~how quickly it's running.
* [ ] Storing cards
	* [ ] IndexDB or LocalStorage?
		* LocalStorage is just so convenient
		* FileSystem API?  All other persistant storage APIs are best-effort and could be lost.
* [ ] Styling cards: Color, name
* [ ] Retrieving cards
	* [ ] Generating barcode images (Is there a browser API for this? If not, what lib?)
		* I imagine that the hardest parts will be displaying the barcode and using the ShapeDetection API.
* [ ] Offline PWA things
	* [ ] Find a good state for auto updating


-----
### Other ideas / Stretch Goals?
* Backup files?
	* Maybe have a download file that saves / restores all of a user's cards? For if they change phones / delete app data.
* Sort the cards?
	* By most frequently used?