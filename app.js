// AURA Farmer - Main Application Logic
class AuraFarmerApp {
    constructor() {
        this.panelGenerator = new PanelGenerator();
        this.panels = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateScaleDisplay();
        this.generateHeaderLogo();
    }

    generateHeaderLogo() {
        const logoContainer = document.getElementById('aura-logo');
        if (logoContainer) {
            // Créer un conteneur SVG pour le logo
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '80');
            svg.setAttribute('height', '80');
            svg.setAttribute('viewBox', '0 0 80 80');
            
            // Utiliser la méthode logo existante
            const logoElement = this.panelGenerator.logo(80, 0, 0, this.panelGenerator.colors.blue, this.panelGenerator.colors.white);
            svg.appendChild(logoElement);
            
            logoContainer.appendChild(svg);
        }
    }

    bindEvents() {
        // Unified panel generation
        document.getElementById('generate-btn').addEventListener('click', () => {
            this.generatePanels();
        });

        // Scale slider
        document.getElementById('scale-input').addEventListener('input', (e) => {
            this.updateScaleDisplay(e.target.value);
        });

        // Download all panels
        document.getElementById('download-all-btn').addEventListener('click', () => {
            this.downloadAllPanels();
        });

        // Clear all panels
        document.getElementById('clear-all-btn').addEventListener('click', () => {
            this.clearAllPanels();
        });

        // Enter key support
        document.getElementById('text-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.generatePanels();
            }
        });
    }

    updateScaleDisplay(value) {
        const scaleValue = value || document.getElementById('scale-input').value;
        document.getElementById('scale-value').textContent = `${scaleValue}px`;
    }

    // Convert SVG to PNG
    async svgToPng(svgElement, scale) {
        return new Promise((resolve, reject) => {
            const svgString = this.panelGenerator.svgToString(svgElement);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            // Set canvas size
            const heightUp = scale;
            const heightDown = 0.32 * scale;
            canvas.width = heightUp;
            canvas.height = heightUp + heightDown;
            
            img.onload = () => {               
                // Draw the SVG
                ctx.drawImage(img, 0, 0);
                
                // Convert to PNG blob
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/png');
            };
            
            img.onerror = reject;
            
            // Create data URL from SVG
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            img.src = url;
        });
    }

    generatePanels() {
        const textInput = document.getElementById('text-input');
        const scaleInput = document.getElementById('scale-input');
        const inputText = textInput.value.trim();
        const scale = parseInt(scaleInput.value);

        if (!inputText) {
            this.showMessage('Veuillez entrer un texte pour le/les panneau(x).', 'error');
            textInput.focus();
            return;
        }

        // Split by lines to handle multiple panels
        const texts = inputText.split('\n').filter(text => text.trim());
        
        if (texts.length === 0) {
            this.showMessage('Veuillez entrer au moins un texte valide.', 'error');
            textInput.focus();
            return;
        }

        // Check for "La Région" spelling errors
        const spellCheckResults = [];
        let hasSpellingErrors = false;
        
        texts.forEach((text, index) => {
            const result = this.panelGenerator.checkLaRegionSpelling(text);
            spellCheckResults.push(result);
            if (result.hasError) {
                hasSpellingErrors = true;
            }
        });
        
        // If there are spelling errors, show warning and ask for confirmation
        if (hasSpellingErrors) {
            this.showSpellingWarning(spellCheckResults, () => {
                this.processPanelGeneration(spellCheckResults.map(r => r.correctedText), scale, textInput);
            }, () => {
                this.processPanelGeneration(texts, scale, textInput);
            });
            return;
        }
        
        // No spelling errors, proceed normally
        this.processPanelGeneration(texts, scale, textInput);
    }
    
    showSpellingWarning(spellCheckResults, onAccept, onOverride) {
        const errorsFound = spellCheckResults.filter(r => r.hasError);
        
        // Populate corrections list
        const correctionsList = document.getElementById('spelling-corrections');
        correctionsList.innerHTML = '';
        
        errorsFound.forEach((error, index) => {
            const correctionItem = document.createElement('div');
            correctionItem.className = 'correction-item';
            correctionItem.innerHTML = `
                <span class="correction-original">"${this.escapeHtml(error.originalText)}"</span>
                <span class="correction-arrow">→</span>
                <span class="correction-fixed">"${this.escapeHtml(error.correctedText)}"</span>
            `;
            correctionsList.appendChild(correctionItem);
        });
        
        // Show modal
        const modal = document.getElementById('spelling-modal');
        modal.classList.add('show');
        
        // Handle modal actions
        const acceptBtn = document.getElementById('modal-accept');
        const cancelBtn = document.getElementById('modal-cancel');
        
        const handleAccept = () => {
            modal.classList.remove('show');
            onAccept();
            cleanup();
        };
        
        const handleCancel = () => {
            modal.classList.remove('show');
            onOverride();
            cleanup();
        };
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };
        
        const handleBackdropClick = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };
        
        const cleanup = () => {
            acceptBtn.removeEventListener('click', handleAccept);
            cancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleEscape);
            modal.removeEventListener('click', handleBackdropClick);
        };
        
        // Add event listeners
        acceptBtn.addEventListener('click', handleAccept);
        cancelBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleEscape);
        modal.addEventListener('click', handleBackdropClick);
    }

    processPanelGeneration(texts, scale, textInput) {
        this.showLoading('generate-btn');
        
        setTimeout(async () => {
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            for (let index = 0; index < texts.length; index++) {
                const text = texts[index];
                try {
                    const cleanText = text.trim();
                    const svgElement = this.panelGenerator.generatePanel(cleanText, scale);
                    
                    // Generate PNG version
                    const pngBlob = await this.svgToPng(svgElement, scale);
                    
                    const panel = {
                        id: Date.now() + index,
                        text: cleanText,
                        scale: scale,
                        svg: svgElement,
                        svgString: this.panelGenerator.svgToString(svgElement),
                        pngBlob: pngBlob
                    };

                    this.panels.push(panel);
                    this.addPanelToDisplay(panel);
                    successCount++;
                } catch (error) {
                    console.error(`Erreur pour le texte "${text}":`, error);
                    errors.push(`"${text.trim()}": ${error.message}`);
                    errorCount++;
                }
            }

            this.updateUI();
            
            // Show appropriate success/error message
            if (errorCount === 0) {
                if (successCount === 1) {
                    this.showMessage('Panneau généré avec succès !', 'success');
                } else {
                    this.showMessage(`${successCount} panneaux générés avec succès !`, 'success');
                }
            } else {
                let message = `${successCount} panneau(x) généré(s) avec succès`;
                if (errorCount > 0) {
                    message += `, ${errorCount} erreur(s).`;
                    if (errors.length > 0) {
                        // Separate errors by new lines for better readability
                        message += `\r\n${errors.join('\r\n')}`;
                    }
                }
                this.showMessage(message, errorCount > successCount ? 'error' : 'success');
            }
            
            // Keep text in input and focus back to it
            textInput.focus();
            
            this.hideLoading('generate-btn');
        }, 100);
    }

    addPanelToDisplay(panel) {
        const container = document.getElementById('panels-container');
        
        // Remove empty state if it exists
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Create panel element
        const panelElement = document.createElement('div');
        panelElement.className = 'panel-item';
        panelElement.dataset.panelId = panel.id;

        // Clone SVG and add to display
        const svgClone = panel.svg.cloneNode(true);
        
        // Base actions (download + remove)
        panelElement.innerHTML = `
            <div class="panel-svg-container"></div>
            <div class="panel-info">
                <div class="panel-text">${this.escapeHtml(panel.text)}</div>
                <div class="panel-size">${panel.scale}px</div>
            </div>
            <div class="panel-actions">
                <button class="btn btn-download btn-small" onclick="app.downloadPanel(${panel.id}, 'png')">
                    📥 PNG
                </button>
                <button class="btn btn-download btn-small" onclick="app.downloadPanel(${panel.id}, 'svg')">
                    📥 SVG
                </button>
                <button class="btn btn-clear btn-small" onclick="app.removePanel(${panel.id})">
                    🗑️ Supprimer
                </button>
            </div>
        `;

        // Add share button only when Web Share API is available (mobile)
        try {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const filename = this.generateFilename(panel.text, null, 'png');
            const file = new File([panel.pngBlob], filename, { type: 'image/png' });
            if (isMobile && navigator.canShare({ files: [file] })) {
                const actions = panelElement.querySelector('.panel-actions');
                const shareBtn = document.createElement('button');
                shareBtn.className = 'btn btn-share btn-small';
                shareBtn.innerHTML = '📱 Partager';
                shareBtn.addEventListener('click', () => this.sharePanel(panel.id));
                // Insert the share button before the remove button
                const removeBtn = actions.querySelector('.btn-clear');
                actions.insertBefore(shareBtn, removeBtn);
            }
        } catch (e) {
            // If accessing navigator throws for any reason, just don't add the share button
        }

        // Add SVG to container
        panelElement.querySelector('.panel-svg-container').appendChild(svgClone);
        
        // Insert at the beginning (most recent first)
        container.insertBefore(panelElement, container.firstChild);
    }

    downloadPanel(panelId, format = 'svg') {
        const panel = this.panels.find(p => p.id === panelId);
        if (!panel) return;

        const filename = this.generateFilename(panel.text, null, format);

        // Standard download for SVG or PNG
        if (format === 'png') {
            this.downloadPNG(panel.pngBlob, filename);
        } else {
            this.downloadSVG(panel.svgString, filename);
        }

        this.showMessage(`Panneau ${format.toUpperCase()} téléchargé !`, 'success');
    }

    // Share a panel via Web Share API (mobile). Falls back to download when share not available.
    async sharePanel(panelId) {
        const panel = this.panels.find(p => p.id === panelId);
        if (!panel) return;

        const filename = this.generateFilename(panel.text, null, 'png');
        const file = new File([panel.pngBlob], filename, { type: 'image/png' });
        await navigator.share({
            title: 'Panneau AURA',
            text: 'Panneau généré avec AURA Farmer',
            files: [file]
        });
        this.showMessage('Panneau PNG partagé ! 📱', 'success');
        return;
    }

    removePanel(panelId) {
        // Remove from panels array
        this.panels = this.panels.filter(p => p.id !== panelId);
        
        // Remove from display
        const panelElement = document.querySelector(`[data-panel-id="${panelId}"]`);
        if (panelElement) {
            panelElement.remove();
        }
        
        this.updateUI();
        this.showMessage('Panneau supprimé.', 'success');
    }

    downloadAllPanels() {
        if (this.panels.length === 0) return;
        
        this.showLoading('download-all-btn');
        
        setTimeout(async () => {
            try {
                const zip = new JSZip();
                
                this.panels.forEach((panel, index) => {
                    // Add SVG version
                    const svgFilename = this.generateFilename(panel.text, index + 1, 'svg');
                    zip.file(svgFilename, panel.svgString);
                    
                    // Add PNG version
                    const pngFilename = this.generateFilename(panel.text, index + 1, 'png');
                    zip.file(pngFilename, panel.pngBlob);
                });
                
                const content = await zip.generateAsync({type: 'blob'});
                const timestamp = new Date().toISOString().slice(0, 10);
                saveAs(content, `panneaux-aura-${timestamp}.zip`);
                
                this.showMessage('Tous les panneaux (SVG + PNG) ont été téléchargés !', 'success');
            } catch (error) {
                this.showMessage('Erreur lors du téléchargement.', 'error');
            } finally {
                this.hideLoading('download-all-btn');
            }
        }, 100);
    }

    clearAllPanels() {
        if (this.panels.length === 0) return;
        
        if (confirm('Êtes-vous sûr de vouloir supprimer tous les panneaux ?')) {
            this.panels = [];
            
            const container = document.getElementById('panels-container');
            container.innerHTML = `
                <div class="empty-state">
                    <p>Aucun panneau généré pour le moment.</p>
                    <p>Utilisez le formulaire ci-dessus pour créer votre premier panneau.</p>
                </div>
            `;
            
            this.updateUI();
            this.showMessage('Tous les panneaux ont été supprimés.', 'success');
        }
    }

    updateUI() {
        const hasContent = this.panels.length > 0;
        
        document.getElementById('download-all-btn').style.display = hasContent ? 'inline-block' : 'none';
        document.getElementById('clear-all-btn').style.display = hasContent ? 'inline-block' : 'none';
        
        // Update panel count in header if needed
        const header = document.querySelector('.output-header h3');
        if (hasContent) {
            header.textContent = `Panneaux générés (${this.panels.length})`;
        } else {
            header.textContent = 'Panneaux générés';
        }
    }

    generateFilename(text, index = null, format = 'svg') {
        // Clean text for filename
        let filename = text
            .replace(/[^a-zA-Z0-9\s\-_]/g, '')
            .replace(/\s+/g, '-')
            .toLowerCase()
            .substring(0, 30);
        
        if (!filename) {
            filename = 'panneau';
        }
        
        if (index !== null) {
            filename = `${index.toString().padStart(2, '0')}-${filename}`;
        }
        
        const extension = format === 'png' ? 'png' : 'svg';
        return `${filename}.${extension}`;
    }

    downloadSVG(svgString, filename) {
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    downloadPNG(pngBlob, filename) {
        const url = URL.createObjectURL(pngBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showLoading(buttonId) {
        const button = document.getElementById(buttonId);
        const originalText = button.innerHTML;
        button.dataset.originalText = originalText;
        button.innerHTML = '<span class="loading"></span>Génération...';
        button.disabled = true;
    }

    hideLoading(buttonId) {
        const button = document.getElementById(buttonId);
        const originalText = button.dataset.originalText;
        if (originalText) {
            button.innerHTML = originalText;
            delete button.dataset.originalText;
        }
        button.disabled = false;
    }

    showMessage(message, type = 'info') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.error-message, .success-message');
        existingMessages.forEach(msg => msg.remove());
        
        // Create new message
        const messageElement = document.createElement('div');
        messageElement.className = type === 'error' ? 'error-message' : 'success-message';
        messageElement.textContent = message;
        
        // Insert after the first input section
        const inputSection = document.querySelector('.input-section');
        inputSection.parentNode.insertBefore(messageElement, inputSection.nextSibling);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AuraFarmerApp();
});