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

        this.showLoading('generate-btn');
        
        setTimeout(() => {
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            texts.forEach((text, index) => {
                try {
                    const cleanText = text.trim();
                    const svgElement = this.panelGenerator.generatePanel(cleanText, scale);
                    const panel = {
                        id: Date.now() + index,
                        text: cleanText,
                        scale: scale,
                        svg: svgElement,
                        svgString: this.panelGenerator.svgToString(svgElement)
                    };

                    this.panels.push(panel);
                    this.addPanelToDisplay(panel);
                    successCount++;
                } catch (error) {
                    console.error(`Erreur pour le texte "${text}":`, error);
                    errors.push(`"${text.trim()}": ${error.message}`);
                    errorCount++;
                }
            });

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
        
        panelElement.innerHTML = `
            <div class="panel-svg-container"></div>
            <div class="panel-info">
                <div class="panel-text">${this.escapeHtml(panel.text)}</div>
                <div class="panel-size">${panel.scale}px</div>
            </div>
            <div class="panel-actions">
                <button class="btn btn-download btn-small" onclick="app.downloadPanel(${panel.id})">
                    📥 Télécharger
                </button>
                <button class="btn btn-clear btn-small" onclick="app.removePanel(${panel.id})">
                    🗑️ Supprimer
                </button>
            </div>
        `;

        // Add SVG to container
        panelElement.querySelector('.panel-svg-container').appendChild(svgClone);
        
        container.appendChild(panelElement);
    }

    downloadPanel(panelId) {
        const panel = this.panels.find(p => p.id === panelId);
        if (!panel) return;

        const filename = this.generateFilename(panel.text);
        this.downloadSVG(panel.svgString, filename);
        this.showMessage('Panneau téléchargé !', 'success');
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
                    const filename = this.generateFilename(panel.text, index + 1);
                    zip.file(filename, panel.svgString);
                });
                
                const content = await zip.generateAsync({type: 'blob'});
                const timestamp = new Date().toISOString().slice(0, 10);
                saveAs(content, `panneaux-aura-${timestamp}.zip`);
                
                this.showMessage('Tous les panneaux ont été téléchargés !', 'success');
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

    generateFilename(text, index = null) {
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
        
        return `${filename}.svg`;
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