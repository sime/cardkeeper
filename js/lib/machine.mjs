export const SkipTransition = Symbol("This symbol represents that the transition should be aborted.");

export function machine() {
	let resolve;
	let prom = new Promise(res => resolve = res);
	let trans = []
	function transition(name, handler = () => name) {
		return function transition_callback(...args) {
			if (trans.includes(name)) {
				const ret = handler(...args);
				if (ret !== SkipTransition) {
					resolve(ret);
				}
			}
		};
	}
	async function state(transitions, ...promises) {
		trans = transitions;
		promises.unshift(prom);

		const ret = await Promise.race(promises);
		
		prom = new Promise(res => resolve = res);
		trans = [];
		return ret;
	}
	return {state, transition};
}