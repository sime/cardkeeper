import { apply_expression } from "./apply-expression.mjs";

const main = document.querySelector('main');

export function mount(expression, className = "") {
	// Remove old contents:
	while (main.firstChild) {
		main.firstChild.remove();
	}
	const temp = new Comment();
	main.appendChild(temp);
	main.className = className;
	apply_expression(expression, temp);
};

export function save() {
	const ret = new DocumentFragment();
	while (main.firstChild) {
		ret.appendChild(main.firstChild);
	}
	return ret;
}