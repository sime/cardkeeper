export class Card {
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
			this.name = "";
			this.color = 0;
			// this.save();
		} else {
			throw "";
		}
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