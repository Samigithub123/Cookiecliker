  "use strict";

// Debug log to verify JavaScript is running
console.log("JavaScript is running!");

class Upgrade {
    constructor({ id, name, description, baseCost, type, value, target }) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.baseCost = baseCost;
        this.type = type; // "click_add", "producer_mult", "global_cps_mult"
        this.value = value; // number (add or multiplier like 2 for 2x)
        this.target = target || null; // producer id for producer_mult or null for all
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

    get baseTotalCps() {
        return this.count * this.cookiesPerSecond;
    }
}

class Game {
	constructor() {
		this.cookies = 0;
		this.baseClickValue = 1;
        this.theme = "dark";
        this.unlocks = [];
        this.upgrades = [
            new Upgrade({ id: "u_click_1", name: "Betere oven", description: "+1 per klik", baseCost: 15, type: "click_add", value: 1 }),
            new Upgrade({ id: "u_click_2", name: "Extra chocochips", description: "+3 per klik", baseCost: 75, type: "click_add", value: 3 }),
            new Upgrade({ id: "u_click_3", name: "Goudmix", description: "+10 per klik", baseCost: 300, type: "click_add", value: 10 }),
            new Upgrade({ id: "u_cur_2x", name: "Snellere cursors", description: "Cursors 2x productief", baseCost: 500, type: "producer_mult", value: 2, target: "p1" }),
            new Upgrade({ id: "u_grandma_2x", name: "Cadeaus van oma", description: "Oma's 2x productief", baseCost: 2500, type: "producer_mult", value: 2, target: "p2" }),
            new Upgrade({ id: "u_global_1_2x", name: "Verbeterde receptuur", description: "+20% totale productie", baseCost: 10000, type: "global_cps_mult", value: 1.2 })
        ];
        this.producers = [
            new Producer({ id: "p1", name: "Cursor", description: "0.1/s", baseCost: 15, cookiesPerSecond: 0.1 }),
            new Producer({ id: "p2", name: "Oma", description: "1/s", baseCost: 100, cookiesPerSecond: 1 }),
            new Producer({ id: "p3", name: "Boerderij", description: "8/s", baseCost: 1100, cookiesPerSecond: 8 }),
            new Producer({ id: "p4", name: "Mijn", description: "47/s", baseCost: 12000, cookiesPerSecond: 47 }),
            new Producer({ id: "p5", name: "Fabriek", description: "260/s", baseCost: 130000, cookiesPerSecond: 260 }),
            new Producer({ id: "p6", name: "Bank", description: "1400/s", baseCost: 1400000, cookiesPerSecond: 1400 }),
            new Producer({ id: "p7", name: "Tempel", description: "7800/s", baseCost: 20000000, cookiesPerSecond: 7800 }),
            new Producer({ id: "p8", name: "Tovenaars toren", description: "44000/s", baseCost: 330000000, cookiesPerSecond: 44000 })
        ];

		this.lastTick = performance.now();
		this.tickInterval = null;
        this.frenzy = { active: false, mult: 1, until: 0 };
	}

    get clickValue() {
        const add = this.upgrades.reduce((sum, u) => {
            if (u.type === "click_add") return sum + u.level * u.value;
            return sum;
        }, 0);
        return this.baseClickValue + add;
    }

    get globalCpsMultiplier() {
        const mult = this.upgrades.reduce((m, u) => {
            if (u.type === "global_cps_mult") return m * Math.pow(u.value, u.level);
            return m;
        }, 1);
        return mult * (this.frenzy.active ? this.frenzy.mult : 1);
    }

    getProducerMultiplier(producerId) {
        let mult = 1;
        for (const u of this.upgrades) {
            if (u.type === "producer_mult" && u.target === producerId) {
                mult *= Math.pow(u.value, u.level);
            }
        }
        return mult;
    }

    get cookiesPerSecond() {
        const base = this.producers.reduce((sum, p) => {
            const effective = p.cookiesPerSecond * this.getProducerMultiplier(p.id);
            return sum + effective * p.count;
        }, 0);
        return base * this.globalCpsMultiplier;
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
        this.checkUnlocks();
		return true;
	}

    buyProducer(producerId) {
		const producer = this.producers.find(p => p.id === producerId);
		if (!producer) return false;
		const cost = producer.cost;
		if (!this.canAfford(cost)) return false;
		this.cookies -= cost;
		producer.count += 1;
        this.checkUnlocks();
		return true;
	}

    update(deltaSeconds) {
        if (this.frenzy.active && performance.now() >= this.frenzy.until) {
            this.frenzy = { active: false, mult: 1, until: 0 };
        }
        this.cookies += this.cookiesPerSecond * deltaSeconds;
    }

    triggerFrenzy(multiplier, msDuration) {
        this.frenzy = { active: true, mult: multiplier, until: performance.now() + msDuration };
    }

    setTheme(theme) {
        this.theme = theme;
    }

    checkUnlocks() {
        // Simple unlocks tied to totals
        const totalProducers = this.producers.reduce((s, p) => s + p.count, 0);
        if (totalProducers >= 10 && !this.unlocks.includes("builder")) this.unlocks.push("builder");
        if (this.cookies >= 100000 && !this.unlocks.includes("rich")) this.unlocks.push("rich");
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
            producers: this.producers.map(p => ({ id: p.id, count: p.count })),
            theme: this.theme,
            unlocks: this.unlocks
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
        if (state.theme) this.theme = state.theme;
        if (Array.isArray(state.unlocks)) this.unlocks = state.unlocks;
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
		this.$perClick = document.createElement("div");
		this.$perSecond = document.createElement("div");
		this.$cookieBtn = document.getElementById("cookieButton");
		this.$upgradeList = document.createElement("div");
		this.$producerList = document.getElementById("producerList");
        this.$overviewList = document.createElement("div");
        this.$unlocksInfo = document.createElement("div");
        
        // Create control buttons
        const controls = document.createElement("div");
        controls.style.position = 'fixed';
        controls.style.bottom = '20px';
        controls.style.left = '20px';
        controls.style.display = 'flex';
        controls.style.gap = '10px';
        
        this.$saveBtn = document.createElement("button");
        this.$saveBtn.textContent = "Save";
        this.$loadBtn = document.createElement("button");
        this.$loadBtn.textContent = "Load";
        this.$resetBtn = document.createElement("button");
        this.$resetBtn.textContent = "Reset";
        
        controls.appendChild(this.$saveBtn);
        controls.appendChild(this.$loadBtn);
        controls.appendChild(this.$resetBtn);
        document.body.appendChild(controls);
        
        this.$themeSelect = document.createElement("select");
        this.$eventLayer = document.createElement("div");
        this.$eventLayer.id = "eventLayer";
        document.body.appendChild(this.$eventLayer);

		this.$cookieBtn.addEventListener("click", () => {
			this.game.click();
            this.spawnClickFx("+" + formatNumber(this.game.clickValue));
			this.render();
		});

		this.$saveBtn.addEventListener("click", () => Storage.save(this.game));
		this.$loadBtn.addEventListener("click", () => {
			const state = Storage.load();
			if (state) {
				this.game.load(state);
                this.applyTheme(this.game.theme);
                this.$themeSelect.value = this.game.theme;
                this.renderLists();
                this.render();
			}
		});
		this.$resetBtn.addEventListener("click", () => {
			if (confirm("Weet je zeker dat je wilt resetten?")) {
				Storage.clear();
				window.location.reload();
			}
		});

        this.$themeSelect.addEventListener("change", () => {
            const value = this.$themeSelect.value;
            this.game.setTheme(value);
            this.applyTheme(value);
            Storage.save(this.game);
        });

		this.renderLists();
        this.applyTheme(this.game.theme);
        this.$themeSelect.value = this.game.theme;
		this.render();

        this.scheduleGoldenCookie();
	},

    renderLists() {
        console.log("Rendering producer list...");
        
        // Clear existing content
        this.$upgradeList.innerHTML = "";
        this.$producerList.innerHTML = "";

        // Render producers with modern UI
        this.game.producers.forEach(producer => {
            const item = document.createElement('div');
            item.className = 'producer-item';
            item.dataset.id = producer.id;
            item.innerHTML = `
                <div class="producer-header">
                    <h3 class="producer-name">${producer.name}</h3>
                    <span class="producer-count">${producer.count}</span>
                </div>
                <div class="producer-details">
                    <div>
                        <div class="producer-cps">${producer.cookiesPerSecond} koekjes per seconde</div>
                        <div class="producer-cost">${formatNumber(producer.cost)} koekjes</div>
                    </div>
                    <button class="buy-btn" data-type="producer" data-id="${producer.id}" 
                            ${!this.game.canAfford(producer.cost) ? 'disabled' : ''}>
                        Koop
                    </button>
                </div>
            `;

            // Add click handler with animation
            const buyBtn = item.querySelector('.buy-btn');
            buyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.game.buyProducer(producer.id)) {
                    // Add animation class
                    item.classList.add('purchase-effect');
                    // Remove the class after animation completes
                    setTimeout(() => {
                        item.classList.remove('purchase-effect');
                    }, 600);
                    this.render();
                }
            });

            this.$producerList.appendChild(item);
        });
        
        // Render upgrades with modern UI if needed
        for (const u of this.game.upgrades) {
            const item = document.createElement('div');
            item.className = 'producer-item';
            item.innerHTML = `
                <div class="producer-header">
                    <h3 class="producer-name">${u.name} <span style="opacity: 0.7; font-size: 0.9em;">(Lv. ${u.level})</span></h3>
                </div>
                <div class="producer-details">
                    <div>
                        <div class="producer-cps">${u.description}</div>
                        <div class="producer-cost">${formatNumber(u.cost)} koekjes</div>
                    </div>
                    <button class="buy-btn" data-type="upgrade" data-id="${u.id}" 
                            ${!this.game.canAfford(u.cost) || u.level >= 1 ? 'disabled' : ''}>
                        ${u.level > 0 ? 'Gekocht' : 'Koop'}
                    </button>
                </div>
            `;
            this.$upgradeList.appendChild(item);
        }

		this.$upgradeList.addEventListener("click", (e) => this.handleBuy(e));
		this.$producerList.addEventListener("click", (e) => this.handleBuy(e));

        this.renderOverview();
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

        // unlocks info
        const unlocksText = this.game.unlocks.length ? this.game.unlocks.join(", ") : "geen";
        this.$unlocksInfo.textContent = `Ontgrendelingen: ${unlocksText}`;

        this.renderOverview();
	}
};

function formatNumber(value) {
	if (value < 1000) return value.toFixed(0);
	if (value < 1_000_000) return (value / 1000).toFixed(2) + "k";
	if (value < 1_000_000_000) return (value / 1_000_000).toFixed(2) + "M";
	return (value / 1_000_000_000).toFixed(2) + "B";
}

// UI helpers
UI.renderOverview = function() {
    if (!this.$overviewList) return;
    this.$overviewList.innerHTML = "";
    // producers
    for (const p of this.game.producers) {
        if (p.count > 0) {
            const li = document.createElement("li");
            li.className = "list-item";
            li.innerHTML = `<div><div class="item-title">${p.name}</div><div class="item-desc">Aantal: ${p.count}</div></div><div class="item-meta"><div>${formatNumber(p.cookiesPerSecond)} /s elk</div></div>`;
            this.$overviewList.appendChild(li);
        }
    }
    // upgrades
    for (const u of this.game.upgrades) {
        if (u.level > 0) {
            const li = document.createElement("li");
            li.className = "list-item";
            li.innerHTML = `<div><div class="item-title">${u.name}</div><div class="item-desc">Niveau: ${u.level}</div></div>`;
            this.$overviewList.appendChild(li);
        }
    }
};

UI.applyTheme = function(theme) {
    const root = document.documentElement;
    const themes = {
        dark: { bg: "#0f172a", panel: "#111827", text: "#e5e7eb", muted: "#9ca3af", primary: "#f59e0b", primary600: "#d97706" },
        slate: { bg: "#0b1220", panel: "#0f172a", text: "#e2e8f0", muted: "#94a3b8", primary: "#22d3ee", primary600: "#06b6d4" },
        sunset: { bg: "#1b1126", panel: "#24112e", text: "#ffd8a8", muted: "#f59f9f", primary: "#ff7b54", primary600: "#ff5b37" },
        retro: { bg: "#2b2f2f", panel: "#1e2222", text: "#f2f2d0", muted: "#a3a38a", primary: "#f2c94c", primary600: "#d4a418" }
    };
    const t = themes[theme] || themes.dark;
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--panel", t.panel);
    root.style.setProperty("--text", t.text);
    root.style.setProperty("--muted", t.muted);
    root.style.setProperty("--primary", t.primary);
    root.style.setProperty("--primary-600", t.primary600);
};

UI.spawnClickFx = function(text) {
    const rect = this.$cookieBtn.getBoundingClientRect();
    const span = document.createElement("span");
    span.textContent = text;
    span.style.position = "fixed";
    span.style.left = (rect.left + rect.width / 2 + (Math.random() * 40 - 20)) + "px";
    span.style.top = (rect.top + rect.height / 2) + "px";
    span.style.color = "var(--success)";
    span.style.pointerEvents = "none";
    span.style.opacity = "1";
    span.style.transition = "transform 600ms ease, opacity 600ms ease";
    span.style.transform = "translateY(0px)";
    document.body.appendChild(span);
    requestAnimationFrame(() => {
        span.style.transform = "translateY(-40px)";
        span.style.opacity = "0";
    });
    setTimeout(() => span.remove(), 650);
};

UI.scheduleGoldenCookie = function() {
    const minMs = 25000, maxMs = 45000;
    const delay = Math.floor(minMs + Math.random() * (maxMs - minMs));
    setTimeout(() => this.spawnGoldenCookie(), delay);
};

UI.spawnGoldenCookie = function() {
    const btn = document.createElement("button");
    btn.textContent = "★";
    btn.setAttribute("aria-label", "Golden Cookie");
    btn.style.position = "fixed";
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    btn.style.left = Math.max(20, Math.random() * (viewportW - 60)) + "px";
    btn.style.top = Math.max(80, Math.random() * (viewportH - 160)) + "px";
    btn.style.zIndex = "9999";
    btn.style.border = "none";
    btn.style.borderRadius = "999px";
    btn.style.padding = "10px 12px";
    btn.style.background = "gold";
    btn.style.color = "#5a3";
    btn.style.boxShadow = "0 6px 16px rgba(0,0,0,.35)";
    btn.style.cursor = "pointer";
    document.body.appendChild(btn);
    const remove = () => { btn.remove(); this.scheduleGoldenCookie(); };
    const timeout = setTimeout(remove, 13000);
    btn.addEventListener("click", () => {
        clearTimeout(timeout);
        btn.remove();
        this.game.triggerFrenzy(7, 15000);
        this.spawnClickFx("Frenzy!");
        this.scheduleGoldenCookie();
    });
};

// Main game initialization
console.log("Script loaded, initializing game...");

// Create game instance
const game = new Game();
console.log("Game instance created");

// Load saved game if available
const saved = Storage.load();
if (saved) {
    console.log("Loading saved game state");
    game.load(saved);
}

// Initialize UI when DOM is fully loaded
window.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded, initializing UI...");
    UI.init(game);
    game.start();
    
    // Autosave every 15 seconds
    setInterval(() => {
        Storage.save(game);
        console.log("Game autosaved");
    }, 15000);
    
    console.log("Game started!");
});
