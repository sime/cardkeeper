export default class Trait {
	constructor(description, implementation = null) {
		this.symbol = Symbol(description);
		this.implementation = implementation;
	}
	[Symbol.toPrimitive]() {
		return this.symbol;
	}
	[Symbol.hasInstance](target) {
		return typeof target == 'object' && target !== null && target[this.symbol] !== undefined;
	}
	get(target) {
		if (!(target instanceof this)) {
			throw new Error("Trait: cannot turn the target into the trait because it doesn't implement it.");
		} else {
			return target[this.symbol];
		}
	}
}