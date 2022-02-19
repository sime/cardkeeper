
import Trait from '../lib/trait.mjs';

export const TemplateExpression = new Trait('An object implementing TemplateExpression can bypass the default apply_expression functionality.');

class SpecialCaseError extends Error {
	constructor(expression, node) {
		super("This expression doesn't work for this location.  Perhaps you should add a special case for it inside [apply-expression.mjs].");
		this.expression = expression;
		this.node = node;
	}
}

// This function is where all the special casing is.  If you want to add special cases, you can change this file, implement the TemplateExpression trait, or use the make_html and make_mount functions to use your own special case function.
export function apply_expression(expression, node) {
	const expr_type = typeof expression;
	if (expression instanceof TemplateExpression) {
		expression[TemplateExpression](node);
	} else if (expression instanceof Function) {
		apply_expression(expression(node), node);
	} else if (expression === undefined || expression === null) { 
		// Do Nothing
	} else if (expr_type == 'number' || expr_type == 'bigint') {
		apply_expression(expression.toString(), node);
	} else if (expr_type == 'string' && node instanceof Comment) {
		node.replaceWith(expression);
	} else if (expr_type == 'string' && node instanceof Attr) {
		node.value = expression;
	} else if (expr_type == 'string' && node instanceof Text) {
		node.data = expression;
	} else if (expression instanceof Node && node instanceof Comment) {
		node.replaceWith(expression);
	} else if (expression instanceof Node && node instanceof Element) {
		node.appendChild(expression);	
	} else if (expr_type == 'object' && expression[Symbol.iterator]) {
		if (node instanceof Comment) {
			// Create new comment nodes at the node's location:
			for (const expr of expression) {
				const t = new Comment();
				node.parentElement.insertBefore(t, node);
				apply_expression(expr, t);
			}
			node.remove();
		} else if (node instanceof Element) {
			// Share the element with all of the expressions:
			for (const expr of expression) {
				apply_expression(expr, node);
			}
		} else {
			throw new SpecialCaseError(expression, node);
		}
	} else {
		throw new SpecialCaseError(expression, node);
	}
}