// JavaScript pour LJV Alumni

document.addEventListener('DOMContentLoaded', function() {
    // Auto-suggestion d'employeurs
    initEmployerSuggestions();
    
    // Confirmation des actions destructives
    initConfirmationDialogs();
    
    // Auto-hide des alertes
    initAutoHideAlerts();
    
    // Validation des formulaires
    initFormValidation();
});

// Auto-suggestion d'employeurs
function initEmployerSuggestions() {
    const employerInputs = document.querySelectorAll('.employer-suggest input');
    
    employerInputs.forEach(input => {
        const suggestionsDiv = input.parentElement.querySelector('.employer-suggestions');
        let timeoutId;
        
        input.addEventListener('input', function() {
            clearTimeout(timeoutId);
            const query = this.value.trim();
            
            if (query.length < 2) {
                hideSuggestions(suggestionsDiv);
                return;
            }
            
            timeoutId = setTimeout(() => {
                fetchEmployerSuggestions(query, suggestionsDiv, input);
            }, 300);
        });
        
        // Cacher les suggestions quand on clique ailleurs
        document.addEventListener('click', function(e) {
            if (!input.parentElement.contains(e.target)) {
                hideSuggestions(suggestionsDiv);
            }
        });
    });
}

async function fetchEmployerSuggestions(query, suggestionsDiv, input) {
    try {
        const response = await fetch(`/profile/api/employers/suggest?q=${encodeURIComponent(query)}`);
        const employers = await response.json();
        
        if (employers.length > 0) {
            showSuggestions(employers, suggestionsDiv, input);
        } else {
            hideSuggestions(suggestionsDiv);
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des suggestions:', error);
        hideSuggestions(suggestionsDiv);
    }
}

function showSuggestions(employers, suggestionsDiv, input) {
    suggestionsDiv.innerHTML = '';
    
    employers.forEach(employer => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <strong>${employer.nom}</strong>
            ${employer.ville ? `<br><small class="text-muted">${employer.ville}</small>` : ''}
        `;
        
        item.addEventListener('click', function() {
            input.value = employer.nom;
            
            // Remplir aussi les champs secteur et ville si disponibles
            const secteurInput = input.form.querySelector('input[name="secteur"]');
            const villeInput = input.form.querySelector('input[name="ville"]');
            
            if (secteurInput && employer.secteur) {
                secteurInput.value = employer.secteur;
            }
            if (villeInput && employer.ville) {
                villeInput.value = employer.ville;
            }
            
            hideSuggestions(suggestionsDiv);
        });
        
        suggestionsDiv.appendChild(item);
    });
    
    suggestionsDiv.style.display = 'block';
}

function hideSuggestions(suggestionsDiv) {
    if (suggestionsDiv) {
        suggestionsDiv.style.display = 'none';
    }
}

// Confirmation des actions destructives
function initConfirmationDialogs() {
    const dangerButtons = document.querySelectorAll('.btn-danger, .btn-outline-danger');
    
    dangerButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const action = this.dataset.action || 'cette action';
            const message = `Êtes-vous sûr de vouloir ${action} ?`;
            
            if (!confirm(message)) {
                e.preventDefault();
            }
        });
    });
}

// Auto-hide des alertes
function initAutoHideAlerts() {
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    
    alerts.forEach(alert => {
        // Auto-hide après 5 secondes pour les alertes de succès
        if (alert.classList.contains('alert-success')) {
            setTimeout(() => {
                fadeOut(alert);
            }, 5000);
        }
    });
}

function fadeOut(element) {
    element.style.transition = 'opacity 0.5s';
    element.style.opacity = '0';
    
    setTimeout(() => {
        element.remove();
    }, 500);
}

// Validation des formulaires
function initFormValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!form.checkValidity()) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            form.classList.add('was-validated');
        });
    });
}

// Utilitaire pour afficher des messages de chargement
function showLoading(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Chargement...';
    button.disabled = true;
    
    return function() {
        button.innerHTML = originalText;
        button.disabled = false;
    };
}

// Utilitaire pour les requêtes AJAX
async function makeRequest(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erreur de requête:', error);
        throw error;
    }
}

// Gestion des uploads de fichiers
function initFileUploads() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            
            // Vérifier la taille du fichier (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                alert('Le fichier est trop volumineux. Taille maximum : 5MB');
                this.value = '';
                return;
            }
            
            // Prévisualisation pour les images
            if (file.type.startsWith('image/')) {
                const preview = this.parentElement.querySelector('.image-preview');
                if (preview) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    });
}

// Initialiser les uploads si présents
if (document.querySelector('input[type="file"]')) {
    initFileUploads();
}
