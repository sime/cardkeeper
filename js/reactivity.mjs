let context = null;

export function use(func) {
	use_later(func)();
}
export function use_later(func) {
	return (...args) => {
		const old_context = context;
		context = func;
		func(...args);
		context = old_context;
	};
}

let to_update = false;
function propagate_changes() {
	for (const waiter of to_update.values()) {
		waiter();
	}
	to_update = false;
}

class WaitSet extends Set {
	aquire() {
		if (context) {
			this.add(context);
		}
	}
	queue() {
		if (to_update === false) {
			to_update = new Set();
			queueMicrotask(propagate_changes);
		}
		for (const waiter of this.values()) {
			to_update.add(waiter);
		}
		this.clear();
	}
}

export function signal(initial_value) {
	const waiters = new WaitSet();
	let value = initial_value;

	function getter() {
		waiters.aquire();
		return value;
	}
	function setter(new_value) {
		if (new_value !== value) {
			value = new_value;
			waiters.queue();
		}
	}
	return [getter, setter];
}