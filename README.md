# Card Keeper: Loyalty/Membership card keeper
Application stores your membership cards, available offline.

User can retrieve membership numbers instantly,
avoiding the need to phicically carry them.

Retrieving the membership card shows an accurate representation
of the barcode which can be scanned at the merchant, e.g. coffee shops, fitness gyms, etc.

## Requirements:
* [X] Reading barcodes
	* Several Kinds of Barcodes and QRCodes
	* The Barcode Reading API can work from a video so we don't need to use canvas at all.
* [X] Storing cards
	* LocalStorage
* [X] Styling cards: Color, name
* [X] Retrieving cards
	* JsBarcode (MIT)
	* qrcode-generator (MIT)
* [X] Offline PWA things
	* The App updates from the card display view.


-----
### Other ideas / Stretch Goals?
* Backup files?
	* Maybe have a download file that saves / restores all of a user's cards? For if they change phones / delete app data.
* Sort the cards?
	* By most frequently used?