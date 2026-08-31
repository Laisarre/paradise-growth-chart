class GrowthChartStandalone {
    constructor() {
        this.ICON_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg'];
        this.iconMode = localStorage.getItem('tamaGrowthChartIconMode') === 'artwork' ? 'artwork' : 'sprite';
        this.characterTypes = [];
        this.deviceTypes = [];
        this.deviceBiomeMap = {};
        this.chartData = null;
        this.filters = { search: '', biomes: new Set(), devices: new Set() };
    }

    async init() {
        document.querySelectorAll('.icon-mode-option').forEach(item => {
            item.addEventListener('click', (e) => this.setIconMode(e.currentTarget.dataset.mode));
        });
        this.updateIconModeToggleUI();
        this.setupReadingControls();

        const content = document.getElementById('chartContent');
        try {
            const [charactersRes, chartRes, deviceTypesRes, deviceBiomesRes] = await Promise.all([
                fetch('characters.json', { cache: 'no-store' }),
                fetch('growth_chart.json', { cache: 'no-store' }),
                fetch('device_types.json', { cache: 'no-store' }),
                fetch('device_type_biomes.json', { cache: 'no-store' })
            ]);
            this.characterTypes = await charactersRes.json();
            this.chartData = await chartRes.json();
            this.deviceTypes = await deviceTypesRes.json();

            const deviceBiomeMap = {};
            const rows = await deviceBiomesRes.json();
            rows.forEach(row => {
                if (!deviceBiomeMap[row.device_type_name]) {
                    deviceBiomeMap[row.device_type_name] = new Set();
                }
                deviceBiomeMap[row.device_type_name].add(row.biome_name);
            });
            this.deviceBiomeMap = deviceBiomeMap;
        } catch (error) {
            console.error('Failed to load growth chart data:', error);
            if (content) content.innerHTML = '<p style="color: #c00;">Не удалось загрузить данные гайда.</p>';
            return;
        }

        this.renderGuideBody();
    }

    stripIconExtension(imagePath) {
        return imagePath ? imagePath.replace(/\.(png|webp|jpe?g)$/i, '') : imagePath;
    }

    getIconFileName(imagePath) {
        if (!imagePath) return '';
        return `${this.iconMode}/${this.stripIconExtension(imagePath)}.${this.ICON_EXTENSIONS[0]}`;
    }

    getDefaultIconFileName() {
        return `${this.iconMode}/default.png`;
    }

    handleIconError(imgEl) {
        const triedIndex = parseInt(imgEl.dataset.iconExtIndex || '0', 10);
        const nextIndex = triedIndex + 1;
        if (nextIndex < this.ICON_EXTENSIONS.length) {
            imgEl.dataset.iconExtIndex = String(nextIndex);
            imgEl.src = imgEl.src.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, `.${this.ICON_EXTENSIONS[nextIndex]}$1`);
        } else {
            imgEl.style.visibility = 'hidden';
        }
    }

    setIconMode(mode) {
        if (mode !== 'sprite' && mode !== 'artwork') return;
        if (this.iconMode === mode) return;
        this.iconMode = mode;
        localStorage.setItem('tamaGrowthChartIconMode', mode);
        this.updateIconModeToggleUI();
        document.querySelectorAll('img[src*="img/icons/"]').forEach(img => {
            img.dataset.iconExtIndex = '0';
            img.style.visibility = '';
            img.src = img.src
                .replace(/img\/icons\/(sprite|artwork)\//, `img/icons/${mode}/`)
                .replace(/\.[a-zA-Z0-9]+(\?.*)?$/, `.${this.ICON_EXTENSIONS[0]}$1`);
        });
    }

    updateIconModeToggleUI() {
        document.querySelectorAll('.icon-mode-option').forEach(el => {
            el.classList.toggle('active', el.dataset.mode === this.iconMode);
        });
    }

    setupReadingControls() {
        const label = document.getElementById('fontSizeLabel');
        const chart = () => document.getElementById('chartContent');

        let scale = parseInt(localStorage.getItem('tamaGrowthChartFontScale'), 10);
        if (!scale || scale < 10 || scale > 160) scale = 100;
        let unpixelized = localStorage.getItem('tamaGrowthChartUnpixelized') === '1';

        const applyAll = () => {
            const el = chart();
            if (el) {
                el.classList.toggle('unpixelized', unpixelized);
                el.style.zoom = scale / 100;
            }
            if (label) label.textContent = `${scale}%`;
        };
        applyAll();

        const stepDown = document.getElementById('fontStepDown');
        const stepUp = document.getElementById('fontStepUp');
        const step = (delta) => {
            scale = Math.max(10, Math.min(160, scale + delta));
            localStorage.setItem('tamaGrowthChartFontScale', String(scale));
            applyAll();
        };
        if (stepDown) stepDown.addEventListener('click', () => step(-10));
        if (stepUp) stepUp.addEventListener('click', () => step(10));

        const pixelFontToggle = document.getElementById('pixelFontToggle');
        if (pixelFontToggle) {
            pixelFontToggle.checked = unpixelized;
            pixelFontToggle.addEventListener('change', () => {
                unpixelized = pixelFontToggle.checked;
                localStorage.setItem('tamaGrowthChartUnpixelized', unpixelized ? '1' : '0');
                applyAll();
            });
        }
    }

    displayTypeName(name) {
        if (!name) return name;
        const biomePrefixes = ['Land', 'Water', 'Sky', 'Forest', 'Tropical', 'Ice'];
        const parts = name.split(' ');
        if (parts.length > 1 && biomePrefixes.includes(parts[0]) && name.endsWith(' Young')) {
            return parts.slice(1).join(' ');
        }
        return name;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML;
    }

    applyGrowthChartSearchHighlight() {
        const content = document.getElementById('chartContent');
        if (!content) return;
        const term = (this.filters.search || '').trim().toLowerCase();
        const cards = content.querySelectorAll('.growth-chart-stage');
        const matchedCards = [];
        cards.forEach(card => {
            const matches = term.length > 0 && card.dataset.name.includes(term);
            card.style.borderColor = matches ? '#ffb8d0' : 'transparent';
            card.style.background = matches ? '#fff0f5' : 'transparent';
            if (matches) matchedCards.push(card);
        });
        if (matchedCards.length === 1) {
            matchedCards[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    attachTapTooltip(el, text) {
        if (!text) return;
        el.title = text;
        el.style.cursor = 'pointer';
        el.style.position = 'relative';
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const alreadyOpen = el.dataset.tooltipOpen === '1';
            document.querySelectorAll('.gc-tooltip-bubble').forEach(b => b.remove());
            document.querySelectorAll('[data-tooltip-open="1"]').forEach(o => { o.dataset.tooltipOpen = ''; });
            if (alreadyOpen) return;
            el.dataset.tooltipOpen = '1';
            const bubble = document.createElement('div');
            bubble.className = 'gc-tooltip-bubble';
            bubble.textContent = text;
            bubble.style.cssText = 'position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 6px; z-index: 3000; background: #333; color: #fff; font-size: 13px; line-height: 1.35; padding: 6px 10px; border-radius: 6px; width: max-content; max-width: 220px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); pointer-events: none; white-space: normal;';
            el.appendChild(bubble);
        });
        if (!this._gcTooltipCloseBound) {
            this._gcTooltipCloseBound = true;
            document.addEventListener('click', () => {
                document.querySelectorAll('.gc-tooltip-bubble').forEach(b => b.remove());
                document.querySelectorAll('[data-tooltip-open="1"]').forEach(o => { o.dataset.tooltipOpen = ''; });
            });
        }
    }

    renderGuideBody() {
        const content = document.getElementById('chartContent');
        const data = this.chartData;
        if (!content || !data) return;

        const deviceBiomeMap = this.deviceBiomeMap || {};
        const filters = this.filters;

        const iconFor = (name) => {
            const type = this.characterTypes.find(t => t.name === name);
            const fileName = type ? this.getIconFileName(type.image_path) : this.getIconFileName(name.replace(/\s+/g, '_'));
            return `img/icons/${fileName}`;
        };

        const cellIconFor = (fileBaseName) => `img/icons/cellicon/${fileBaseName}.${this.ICON_EXTENSIONS[0]}`;
        const foodCellIconFor = (fileBaseName) => `img/icons/cellicon/Food/${fileBaseName}.${this.ICON_EXTENSIONS[0]}`;
        const fieldCellIconFor = (fileBaseName) => `img/icons/cellicon/Field/${fileBaseName}.${this.ICON_EXTENSIONS[0]}`;
        const biomeFieldIconFor = (biomeName) => `img/icons/field/${biomeName}.${this.ICON_EXTENSIONS[0]}`;

        const FOOD_CELL_ICON_MAP = {
            'Meat': 'Meat',
            'Carrot': 'Carrot',
            'Chicken': 'Chicken',
            'Corn': 'Corn',
            'Bamboo Grass': 'Bamboo_Grass',
            'Frozen Meat': 'Frozen_Meat',
            'Pomegranate': 'Pomegranate',
            'Seafood': 'Seafood',
            'Seaweed': 'Seaweed',
            'Syrup': 'Syrup',
            'Worm': 'Meal_Worm',
            'Peking Meat': 'Pecking_Meat',
            'Frozen Berry': 'Red_Berries',
            'Frozen Seafood': 'Northern_Seafood',
            'Tropical Critter': 'Butterflies',
            'Tropical Fruit': 'Banana',
            'Tropical Meat': 'Tropical_Meat',
            'Shrimp': 'Plankton'
        };

        const SOURCE_COLOR = { 'Volcano': '#e0703c', 'Spring': '#4fae7a', 'Shop or cook': '#8a6bc4', 'Volcano & Spring': '#3f8fb0' };

        const buildFoodItemsList = (foodItems) => {
            const parsed = foodItems.map(raw => {
                const m = raw.match(/^(.*)\(([^)]+)\)\s*$/);
                if (!m) return { text: raw, source: null };
                let source = m[2].trim();
                if (source === 'Any hunt') source = 'Volcano & Spring';
                return { text: m[1].trim(), source };
            });
            const order = [];
            const bySource = {};
            parsed.forEach(p => {
                const key = p.source || '';
                if (!bySource[key]) { bySource[key] = []; order.push(key); }
                bySource[key].push(p.text);
            });
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width: 100%; text-align: center; margin-top: 2px; white-space: normal;';
            order.forEach(source => {
                if (source) {
                    const heading = document.createElement('div');
                    heading.textContent = source;
                    heading.style.cssText = `font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; font-weight: bold; margin-top: 5px; color: ${SOURCE_COLOR[source] || '#999'};`;
                    wrap.appendChild(heading);
                }
                bySource[source].forEach(text => {
                    const line = document.createElement('div');
                    line.textContent = text;
                    line.style.cssText = 'font-size: 13px; color: #aaa; line-height: 1.3;';
                    wrap.appendChild(line);
                });
            });
            return wrap;
        };

        const CARE_CELL_KEY = { Hunger: 'Hunger', Happy: 'Happy', Care_Miss: 'Mistake' };

        const buildStatChip = (fileBaseName, text) => {
            const chip = document.createElement('span');
            chip.style.cssText = 'display: inline-flex; align-items: center; gap: 3px;';
            const tooltip = data.careCells[CARE_CELL_KEY[fileBaseName]];
            this.attachTapTooltip(chip, tooltip);
            const img = document.createElement('img');
            img.src = cellIconFor(fileBaseName);
            img.alt = fileBaseName;
            img.style.cssText = 'width: 15px; height: 15px; object-fit: contain;';
            img.onerror = () => this.handleIconError(img);
            chip.appendChild(img);
            const span = document.createElement('span');
            span.textContent = text;
            chip.appendChild(span);
            return chip;
        };

        const deviceAllowedBiomes = filters.devices.size > 0
            ? new Set([...filters.devices].flatMap(d => [...(deviceBiomeMap[d] || [])]))
            : null;

        const searchTerm = (filters.search || '').trim().toLowerCase();
        const matchesSearch = (name) => !!name && name.toLowerCase().includes(searchTerm);
        const biomeHasSearchMatch = (biome) => {
            if (matchesSearch(biome.kid)) return true;
            if (biome.youngTypes.some(yt => matchesSearch(yt.youngName) || ['special', '0-1', '2-5', '6+'].some(k => matchesSearch(yt.stages[k])))) return true;
            const hybrid = data.hybrids.find(h => h.field === biome.field);
            return !!hybrid && matchesSearch(hybrid.name);
        };

        const visibleBiomes = data.biomes.filter(biome => {
            if (filters.biomes.size > 0 && !filters.biomes.has(biome.field)) return false;
            if (deviceAllowedBiomes && !deviceAllowedBiomes.has(biome.field)) return false;
            if (searchTerm && !biomeHasSearchMatch(biome)) return false;
            return true;
        });

        const wasSearchFocused = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.growthChartSearch === '1';
        const searchCursorPos = wasSearchFocused ? document.activeElement.selectionStart : null;

        content.innerHTML = '';

        const filterBar = document.createElement('div');
        filterBar.style.cssText = 'margin-bottom: 14px; display: flex; flex-direction: column; gap: 8px; padding-bottom: 10px; border-bottom: 2px solid #eee;';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Find by name...';
        searchInput.value = filters.search;
        searchInput.dataset.growthChartSearch = '1';
        searchInput.style.cssText = 'width: 100%; max-width: 320px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 18px;';
        searchInput.addEventListener('input', () => {
            this.filters.search = searchInput.value;
            this.renderGuideBody();
        });
        filterBar.appendChild(searchInput);

        const buildChipRow = (labelText, items, getName, selectedSet, chipColor, chipBg, getIconFile) => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; align-items: center;';
            const label = document.createElement('span');
            label.textContent = labelText;
            label.style.cssText = 'font-size: 17px; font-weight: bold; margin-right: 4px; color: #555;';
            row.appendChild(label);
            items.forEach(item => {
                const name = getName(item);
                const active = selectedSet.has(name);
                const chip = document.createElement('span');
                chip.style.cssText = `
                    display: inline-flex; align-items: center; gap: 4px;
                    cursor: pointer; padding: 4px 10px; border-radius: 12px; font-size: 16px;
                    border: 2px solid ${active ? chipColor : '#ccc'};
                    background: ${active ? chipBg : '#f8f9fa'};
                    color: #333; transition: all 0.15s ease;
                `;
                const iconFile = getIconFile ? getIconFile(item) : null;
                if (iconFile) {
                    const icon = document.createElement('img');
                    icon.src = biomeFieldIconFor(iconFile);
                    icon.alt = name;
                    icon.style.cssText = 'width: 14px; height: 14px; object-fit: contain;';
                    icon.onerror = () => this.handleIconError(icon);
                    chip.appendChild(icon);
                }
                const label2 = document.createElement('span');
                label2.textContent = name;
                chip.appendChild(label2);
                chip.addEventListener('click', () => {
                    if (selectedSet.has(name)) selectedSet.delete(name);
                    else selectedSet.add(name);
                    this.renderGuideBody();
                });
                row.appendChild(chip);
            });
            return row;
        };

        filterBar.appendChild(buildChipRow('Biome:', data.biomes, b => b.field, filters.biomes, '#ffb8d0', '#fff0f5', b => b.field.replace(' Field', '')));
        filterBar.appendChild(buildChipRow('Shell:', this.deviceTypes || [], t => t.name, filters.devices, '#9fcfbe', '#d8f1e7'));

        content.appendChild(filterBar);

        const stageCard = (name) => {
            const card = document.createElement('div');
            card.className = 'growth-chart-stage';
            card.dataset.name = name.toLowerCase();
            card.style.cssText = 'display: flex; flex-direction: column; align-items: center; padding: 6px; border-radius: 6px; border: 2px solid transparent; transition: all 0.2s ease;';
            const img = document.createElement('img');
            img.src = iconFor(name);
            img.alt = name;
            img.style.cssText = 'width: 44px; height: 44px; object-fit: contain;';
            img.onerror = () => this.handleIconError(img);
            const label = document.createElement('div');
            label.textContent = name;
            label.style.cssText = 'font-size: 16px; text-align: center; margin-top: 2px;';
            card.appendChild(img);
            card.appendChild(label);
            return card;
        };

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; gap: 14px; align-items: center; justify-content: center; margin-bottom: 14px; flex-wrap: wrap;';
        topRow.appendChild(stageCard(data.babymarutchi.from));
        const arrow = document.createElement('div');
        arrow.textContent = '⇢';
        arrow.style.cssText = 'font-size: 20px; color: #999;';
        topRow.appendChild(arrow);
        const bbBox = document.createElement('div');
        bbBox.style.cssText = 'display: flex; align-items: center; gap: 10px; background: #f1f1f1; border-radius: 8px; padding: 8px 12px; max-width: 420px;';
        bbBox.appendChild(stageCard(data.babymarutchi.name));
        const bbRule = document.createElement('div');
        bbRule.textContent = data.babymarutchi.rule;
        bbRule.style.cssText = 'font-size: 16px; color: #444;';
        bbBox.appendChild(bbRule);
        topRow.appendChild(bbBox);
        content.appendChild(topRow);

        const buildBranchConnector = (colStart, colSpan, color) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = `grid-column: ${colStart} / span ${colSpan}; position: relative; height: 26px; margin: 6px 0;`;
            const bar = document.createElement('div');
            bar.style.cssText = `position: absolute; left: 0; right: 0; top: 0; height: 10px; background: ${color}; border-radius: 6px;`;
            wrap.appendChild(bar);
            const colWidth = 165, colGap = 8;
            for (let i = 0; i < colSpan; i++) {
                const tick = document.createElement('div');
                const center = i * (colWidth + colGap) + colWidth / 2;
                tick.style.cssText = `position: absolute; left: ${center}px; top: 0; bottom: 0; width: 5px; margin-left: -2.5px; background: ${color};`;
                wrap.appendChild(tick);
            }
            return wrap;
        };

        const biomesWrap = document.createElement('div');
        biomesWrap.style.cssText = 'display: flex; flex-direction: row; gap: 14px; overflow-x: auto; padding-bottom: 10px;';

        if (visibleBiomes.length === 0) {
            const empty = document.createElement('p');
            empty.textContent = 'No biomes match the selected filters.';
            empty.style.cssText = 'color: #888;';
            biomesWrap.appendChild(empty);
        }

        visibleBiomes.forEach(biome => {
            const biomeColor = biome.color || '#ddd';
            const col = document.createElement('div');
            col.style.cssText = `border: 2px solid ${biomeColor}; border-radius: 8px; padding: 9px; flex-shrink: 0;`;

            const kidRow = document.createElement('div');
            kidRow.style.cssText = 'text-align: center; margin-bottom: 8px; font-weight: bold;';
            const kidLabel = document.createElement('div');
            kidLabel.style.cssText = `display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 20px; color: ${biomeColor}; margin-bottom: 4px;`;
            const kidLabelIcon = document.createElement('img');
            kidLabelIcon.src = biomeFieldIconFor(biome.field.replace(' Field', ''));
            kidLabelIcon.alt = biome.field;
            kidLabelIcon.style.cssText = 'width: 22px; height: 22px; object-fit: contain;';
            kidLabelIcon.onerror = () => this.handleIconError(kidLabelIcon);
            kidLabel.appendChild(kidLabelIcon);
            const kidLabelText = document.createElement('span');
            kidLabelText.textContent = biome.field;
            kidLabel.appendChild(kidLabelText);
            kidRow.appendChild(kidLabel);
            kidRow.appendChild(stageCard(biome.kid));

            const fieldDesc = data.fieldCells[biome.field.replace(' Field', '')];
            if (fieldDesc) {
                const fieldLine = document.createElement('div');
                fieldLine.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 6px; font-size: 15px; font-weight: normal; color: #666;';
                this.attachTapTooltip(fieldLine, fieldDesc);
                const fieldIcon = document.createElement('img');
                fieldIcon.src = fieldCellIconFor(biome.field.replace(/\s+/g, '_'));
                fieldIcon.alt = biome.field;
                fieldIcon.style.cssText = 'width: 20px; height: 20px; object-fit: contain;';
                fieldIcon.onerror = () => this.handleIconError(fieldIcon);
                fieldLine.appendChild(fieldIcon);
                const fieldText = document.createElement('span');
                fieldText.textContent = 'Field Cells';
                fieldLine.appendChild(fieldText);
                kidRow.appendChild(fieldLine);
            }

            col.appendChild(kidRow);

            const kidYoungConnector = document.createElement('div');
            kidYoungConnector.style.cssText = `display: grid; grid-template-columns: 55px repeat(${biome.youngTypes.length}, 165px); gap: 8px;`;
            kidYoungConnector.appendChild(buildBranchConnector(2, biome.youngTypes.length, biomeColor));
            col.appendChild(kidYoungConnector);

            const grid = document.createElement('div');
            grid.style.cssText = `display: grid; grid-template-columns: 55px repeat(${biome.youngTypes.length}, 165px); gap: 8px; align-items: center;`;

            grid.appendChild(document.createElement('div'));
            biome.youngTypes.forEach(yt => {
                const header = document.createElement('div');
                header.style.cssText = 'display: flex; flex-direction: column; align-items: center; text-align: center; white-space: nowrap; align-self: start;';

                const displayYoungName = this.displayTypeName(yt.youngName);

                const icon = document.createElement('img');
                icon.src = iconFor(yt.youngName);
                icon.alt = displayYoungName;
                icon.style.cssText = 'width: 40px; height: 40px; object-fit: contain;';
                icon.onerror = () => this.handleIconError(icon);
                header.appendChild(icon);

                const nameLine = document.createElement('div');
                nameLine.textContent = displayYoungName;
                nameLine.style.cssText = 'font-size: 17px; font-weight: bold; margin-top: 2px;';
                header.appendChild(nameLine);

                const foodLine = document.createElement('div');
                foodLine.style.cssText = 'font-size: 17px; color: #888; display: flex; align-items: center; justify-content: center; gap: 4px;';
                const foodIconFile = FOOD_CELL_ICON_MAP[yt.foodCell];
                if (foodIconFile) {
                    const foodIcon = document.createElement('img');
                    foodIcon.src = foodCellIconFor(foodIconFile);
                    foodIcon.alt = yt.foodCell;
                    foodIcon.style.cssText = 'width: 16px; height: 16px; object-fit: contain;';
                    foodIcon.onerror = () => this.handleIconError(foodIcon);
                    foodLine.appendChild(foodIcon);
                }
                const foodText = document.createElement('span');
                foodText.textContent = `${yt.foodCell} Cells`;
                foodLine.appendChild(foodText);
                header.appendChild(foodLine);

                const foodItems = data.foodCells[yt.foodCell];
                if (foodItems) {
                    header.appendChild(buildFoodItemsList(foodItems));
                }

                grid.appendChild(header);
            });

            grid.appendChild(document.createElement('div'));
            grid.appendChild(buildBranchConnector(2, biome.youngTypes.length, biomeColor));

            ['special', '0-1', '2-5', '6+'].forEach(stageKey => {
                const rowLabel = document.createElement('div');
                rowLabel.style.cssText = 'font-size: 16px; color: #666; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; padding-right: 6px;';
                if (stageKey === 'special') {
                    rowLabel.appendChild(buildStatChip('Hunger', '5'));
                    rowLabel.appendChild(buildStatChip('Happy', '5'));
                    rowLabel.appendChild(buildStatChip('Care_Miss', '0'));
                } else {
                    rowLabel.appendChild(buildStatChip('Care_Miss', stageKey));
                }
                grid.appendChild(rowLabel);

                biome.youngTypes.forEach(yt => {
                    const stageName = yt.stages[stageKey];
                    grid.appendChild(stageName ? stageCard(stageName) : document.createElement('div'));
                });
            });

            const hybrid = data.hybrids.find(h => h.field === biome.field);
            const hybridPassesFilter = hybrid && (filters.devices.size === 0 || filters.devices.has(hybrid.shell));
            if (hybridPassesFilter) {
                const hybridBox = document.createElement('div');
                hybridBox.style.cssText = `grid-column: 2 / ${biome.youngTypes.length + 1}; margin-top: 10px; margin-left: 20px; margin-right: 15px; border: 2px solid #cbb; border-radius: 8px; padding: 10px; display: grid; grid-template-columns: 101px 1fr; gap: 10px; align-items: center;`;
                const hybridIcon = stageCard(hybrid.name);
                hybridBox.appendChild(hybridIcon);
                const hybridRule = document.createElement('div');
                hybridRule.textContent = hybrid.rule;
                hybridRule.style.cssText = 'font-size: 16px; color: #444;';
                hybridBox.appendChild(hybridRule);
                grid.appendChild(hybridBox);
            }

            col.appendChild(grid);

            biomesWrap.appendChild(col);
        });

        content.appendChild(biomesWrap);

        const notes = document.createElement('div');
        notes.style.cssText = 'margin-top: 18px; padding-top: 14px; border-top: 2px solid #eee; font-size: 15px; color: #888; display: flex; flex-direction: column; gap: 5px;';
        (data.notes || []).forEach(note => {
            const line = document.createElement('div');
            line.textContent = note;
            notes.appendChild(line);
        });
        content.appendChild(notes);

        if (wasSearchFocused) {
            searchInput.focus();
            searchInput.setSelectionRange(searchCursorPos, searchCursorPos);
        }

        this.applyGrowthChartSearchHighlight();
    }
}

const growthChart = new GrowthChartStandalone();
document.addEventListener('DOMContentLoaded', () => growthChart.init());
