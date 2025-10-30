
"use strict";

class CookieClicker {
	constructor() {
		this.count = 0;
		this.$counter = document.getElementById("cookies");
		this.$button = document.getElementById("cookieButton");
		this.$image = document.getElementById("cookieImage");
		this.bind();
		this.render();
	}

	bind() {
		if (this.$button) {
			this.$button.addEventListener("click", () => {
				this.count += 1;
				this.render();
			});
		}
	}

	render() {
		if (this.$counter) this.$counter.textContent = String(this.count);
	}
}

window.addEventListener("DOMContentLoaded", () => {
	new CookieClicker();
});
