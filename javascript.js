"use strict";

class Upgrade {
	constructor({ id, name, description, baseCost, clickBonus }) {
		this.id = id;
		this.name = name;
		this.description = description;
		this.baseCost = baseCost;
		this.clickBonus = clickBonus; // flat increase to cookies per click
		this.level = 0;
	}

	get cost() {
		return Math.floor(this.baseCost * Math.pow(1.6, this.level));
	}
}

class Producer {
	constructor({ id, name, description, baseCost, cookiesPerSecond }) {
		this.id = id;
		this.name = name;
		this.description = description;
		this.baseCost = baseCost;
		this.cookiesPerSecond = cookiesPerSecond;
		this.count = 0;
	}

	get cost() {
		return Math.floor(this.baseCost * Math.pow(1.15, this.count));
	}

	get totalCps() {
		return this.count * this.cookiesPerSecond;
	}
}

class Game {
	constructor() {
		this.cookies = 0;
		this.baseClickValue = 1;
		this.upgrades = [
			new Upgrade({ id: "u1", name: "Betere oven", description: "+1 per klik", baseCost: 15, clickBonus: 1 }),
			new Upgrade({ id: "u2", name: "Chocochips", description: "+3 per klik", baseCost: 75, clickBonus: 3 }),
			new Upgrade({ id: "u3", name: "Goudmix", description: "+10 per klik", baseCost: 300, clickBonus: 10 })
		];
		this.producers = [
			new Producer({ id: "p1", name: "Cursor", description: "0.1/s", baseCost: 25, cookiesPerSecond: 0.1 }),
			new Producer({ id: "p2", name: "Oma", description: "1/s", baseCost: 100, cookiesPerSecond: 1 }),
			new Producer({ id: "p3", name: "Boerderij", description: "8/s", baseCost: 1100, cookiesPerSecond: 8 })
		];

		this.lastTick = performance.now();
		this.tickInterval = null;
	}

	get clickValue() {
		const bonus = this.upgrades.reduce((sum, u) => sum + u.level * u.clickBonus, 0);
		return this.baseClickValue + bonus;
	}

	get cookiesPerSecond() {
		return this.producers.reduce((sum, p) => sum + p.totalCps, 0);
	}

	click() {
		this.cookies += this.clickValue;
	}

	canAfford(amount) {
		return this.cookies >= amount;
	}

	buyUpgrade(upgradeId) {
		const upgrade = this.upgrades.find(u => u.id === upgradeId);
		if (!upgrade) return false;
		const cost = upgrade.cost;
		if (!this.canAfford(cost)) return false;
		this.cookies -= cost;
		upgrade.level += 1;
		return true;
	}

	buyProducer(producerId) {
		const producer = this.producers.find(p => p.id === producerId);
		if (!producer) return false;
		const cost = producer.cost;
		if (!this.canAfford(cost)) return false;
		this.cookies -= cost;
		producer.count += 1;
		return true;
	}

	update(deltaSeconds) {
		this.cookies += this.cookiesPerSecond * deltaSeconds;
	}

	start() {
		if (this.tickInterval) return;
		this.lastTick = performance.now();
		this.tickInterval = setInterval(() => {
			const now = performance.now();
			const delta = (now - this.lastTick) / 1000;
			this.lastTick = now;
			this.update(delta);
			UI.render();
		}, 100);
	}

	stop() {
		if (this.tickInterval) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}

	serialize() {
		return {
			cookies: this.cookies,
			upgrades: this.upgrades.map(u => ({ id: u.id, level: u.level })),
			producers: this.producers.map(p => ({ id: p.id, count: p.count }))
		};
	}

	load(state) {
		if (!state) return;
		this.cookies = Number(state.cookies) || 0;
		for (const u of state.upgrades || []) {
			const target = this.upgrades.find(x => x.id === u.id);
			if (target) target.level = Number(u.level) || 0;
		}
		for (const p of state.producers || []) {
			const target = this.producers.find(x => x.id === p.id);
			if (target) target.count = Number(p.count) || 0;
		}
	}
}

const Storage = {
	key: "cookie-clicker-oop-state",
	save(game) {
		try {
			localStorage.setItem(this.key, JSON.stringify(game.serialize()));
			return true;
		} catch (e) {
			console.error(e);
			return false;
		}
	},
	load() {
		try {
			const raw = localStorage.getItem(this.key);
			return raw ? JSON.parse(raw) : null;
		} catch (e) {
			console.error(e);
			return null;
		}
	},
	clear() { localStorage.removeItem(this.key); }
};

const UI = {
	init(game) {
		this.game = game;
		this.$cookies = document.getElementById("cookies");
		this.$perClick = document.getElementById("perClick");
		this.$perSecond = document.getElementById("perSecond");
		this.$cookieBtn = document.getElementById("cookieButton");
		this.$upgradeList = document.getElementById("upgradeList");
		this.$producerList = document.getElementById("producerList");
		this.$saveBtn = document.getElementById("saveBtn");
		this.$loadBtn = document.getElementById("loadBtn");
		this.$resetBtn = document.getElementById("resetBtn");

		this.$cookieBtn.addEventListener("click", () => {
			this.game.click();
			this.render();
		});

		this.$saveBtn.addEventListener("click", () => Storage.save(this.game));
		this.$loadBtn.addEventListener("click", () => {
			const state = Storage.load();
			if (state) {
				this.game.load(state);
				this.render();
			}
		});
		this.$resetBtn.addEventListener("click", () => {
			if (confirm("Weet je zeker dat je wilt resetten?")) {
				Storage.clear();
				window.location.reload();
			}
		});

		this.renderLists();
		this.render();
	},

	renderLists() {
		this.$upgradeList.innerHTML = "";
		for (const u of this.game.upgrades) {
			const li = document.createElement("li");
			li.className = "list-item";
			li.innerHTML = `
				<div>
					<div class="item-title">${u.name} (Lv. ${u.level})</div>
					<div class="item-desc">${u.description}</div>
				</div>
				<div class="item-meta">
					<div>Prijs: <strong>${formatNumber(u.cost)}</strong></div>
					<button class="buy-btn" data-type="upgrade" data-id="${u.id}">Koop</button>
				</div>
			`;
			this.$upgradeList.appendChild(li);
		}

		this.$producerList.innerHTML = "";
		for (const p of this.game.producers) {
			const li = document.createElement("li");
			li.className = "list-item";
			li.innerHTML = `
				<div>
					<div class="item-title">${p.name} (x${p.count})</div>
					<div class="item-desc">${p.description}</div>
				</div>
				<div class="item-meta">
					<div>Prijs: <strong>${formatNumber(p.cost)}</strong></div>
					<div>+${p.cookiesPerSecond}/s</div>
					<button class="buy-btn" data-type="producer" data-id="${p.id}">Koop</button>
				</div>
			`;
			this.$producerList.appendChild(li);
		}

		this.$upgradeList.addEventListener("click", (e) => this.handleBuy(e));
		this.$producerList.addEventListener("click", (e) => this.handleBuy(e));
	},

	handleBuy(e) {
		const button = e.target.closest("button.buy-btn");
		if (!button) return;
		const type = button.getAttribute("data-type");
		const id = button.getAttribute("data-id");
		if (type === "upgrade") this.game.buyUpgrade(id);
		if (type === "producer") this.game.buyProducer(id);
		this.renderLists();
		this.render();
	},

	render() {
		this.$cookies.textContent = formatNumber(this.game.cookies);
		this.$perClick.textContent = formatNumber(this.game.clickValue);
		this.$perSecond.textContent = formatNumber(this.game.cookiesPerSecond);

		// enable/disable buy buttons by affordability
		for (const btn of document.querySelectorAll(".buy-btn")) {
			const type = btn.getAttribute("data-type");
			const id = btn.getAttribute("data-id");
			let cost = Infinity;
			if (type === "upgrade") cost = this.game.upgrades.find(u => u.id === id).cost;
			if (type === "producer") cost = this.game.producers.find(p => p.id === id).cost;
			btn.disabled = !this.game.canAfford(cost);
		}
	}
};

function formatNumber(value) {
	if (value < 1000) return value.toFixed(0);
	if (value < 1_000_000) return (value / 1000).toFixed(2) + "k";
	if (value < 1_000_000_000) return (value / 1_000_000).toFixed(2) + "M";
	return (value / 1_000_000_000).toFixed(2) + "B";
}

const game = new Game();
const saved = Storage.load();
if (saved) game.load(saved);

window.addEventListener("DOMContentLoaded", () => {
	UI.init(game);
	game.start();
	// autosave every 15s
	setInterval(() => Storage.save(game), 15000);
});
