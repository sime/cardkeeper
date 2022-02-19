// Event Handling
export function on(event, handler, options = {}) {
	return (target, signal) => {
		target.addEventListener(event, handler, { signal, ...options });
	};
}