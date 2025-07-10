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

    // Show/Hide Admins Switch
    initShowAdminsSwitch();
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

function initShowAdminsSwitch() {
    const showAdminsSwitch = document.getElementById('showAdminsSwitch');
    if (!showAdminsSwitch) return;

    // Get initial state from localStorage or data attribute
    let showAdmins = localStorage.getItem('showAdmins') === 'true';
    if (localStorage.getItem('showAdmins') === null) {
        showAdmins = showAdminsSwitch.dataset.initialState === 'true';
    }
    showAdminsSwitch.checked = showAdmins;
    
    // Function to update the user list via AJAX
    async function updateUserList() {
        const currentUrl = new URL(window.location.href);
        const params = new URLSearchParams(currentUrl.search);

        // Update show_admins parameter
        params.set('show_admins', showAdminsSwitch.checked);
        
        // Preserve other filters
        const form = document.querySelector('.card-body form');
        if (form) {
            new FormData(form).forEach((value, key) => {
                if (key !== 'show_admins') { // Avoid duplicating
                    params.set(key, value);
                }
            });
        }

        // Remove page parameter to reset to first page on filter change
        params.delete('page');

        const queryString = params.toString();
        const apiUrl = `/users/api/users?${queryString}`;

        try {
            const response = await makeRequest(apiUrl);
            
            // Update user list
            const userListContainer = document.querySelector('.row'); // Assuming this contains the user cards
            if (userListContainer) {
                userListContainer.innerHTML = ''; // Clear current list
                if (response.users.length > 0) {
                    response.users.forEach(user => {
                        const userCard = `
                            <div class="col-md-6 col-lg-4 mb-4">
                                <div class="card h-100">
                                    <div class="card-body d-flex flex-column">
                                        <div class="d-flex align-items-center mb-3">
                                            ${user.profile_picture ? 
                                                `<img src="${user.profile_picture}" class="rounded-circle me-3" 
                                                    style="width: 60px; height: 60px; object-fit: cover;" alt="Photo de profil">` :
                                                `<div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3"
                                                    style="width: 60px; height: 60px; font-size: 1.5rem;">
                                                    ${user.prenom.charAt(0)}${user.nom.charAt(0)}
                                                </div>`
                                            }
                                            <div>
                                                <h5 class="card-title mb-0">
                                                    <a href="/users/${user.id}" class="text-decoration-none text-dark">
                                                        ${user.prenom} ${user.nom}
                                                    </a>
                                                </h5>
                                                <p class="card-subtitle text-muted">${user.section_nom} - ${user.annee_diplome}</p>
                                            </div>
                                        </div>
                                        ${user.current_position && user.current_employer ? 
                                            `<p class="card-text mt-auto"><small class="text-muted">${user.current_position} chez ${user.current_employer}</small></p>` : ''
                                        }
                                    </div>
                                </div>
                            </div>
                        `;
                        userListContainer.insertAdjacentHTML('beforeend', userCard);
                    });
                } else {
                    userListContainer.innerHTML = `
                        <div class="alert alert-info" role="alert">
                            Aucun ancien trouvé correspondant à vos critères.
                        </div>
                    `;
                }
            }

            // Update pagination
            const paginationNav = document.querySelector('.pagination');
            if (paginationNav) {
                paginationNav.innerHTML = ''; // Clear current pagination
                const pagination = response.pagination;
                const baseUrl = `/users?${params.toString()}`; // Base URL for pagination links

                const prevLink = `
                    <li class="page-item ${!pagination.hasPrev ? 'disabled' : ''}">
                        <a class="page-link" href="${baseUrl}&page=${pagination.current - 1}" aria-label="Previous">
                            <span aria-hidden="true">&laquo;</span>
                        </a>
                    </li>
                `;
                paginationNav.insertAdjacentHTML('beforeend', prevLink);

                for (let i = 1; i <= pagination.total; i++) {
                    const pageLink = `
                        <li class="page-item ${pagination.current == i ? 'active' : ''}">
                            <a class="page-link" href="${baseUrl}&page=${i}">${i}</a>
                        </li>
                    `;
                    paginationNav.insertAdjacentHTML('beforeend', pageLink);
                }

                const nextLink = `
                    <li class="page-item ${!pagination.hasNext ? 'disabled' : ''}">
                        <a class="page-link" href="${baseUrl}&page=${pagination.current + 1}" aria-label="Next">
                            <span aria-hidden="true">&raquo;</span>
                        </a>
                    </li>
                `;
                paginationNav.insertAdjacentHTML('beforeend', nextLink);
            }

            // Update URL in browser without reloading
            window.history.pushState({ path: currentUrl.pathname + '?' + queryString }, '', currentUrl.pathname + '?' + queryString);

        } catch (error) {
            console.error('Error updating user list:', error);
            // Optionally display an error message to the user
        }
    }

    // Event listener for the switch
    showAdminsSwitch.addEventListener('change', function() {
        localStorage.setItem('showAdmins', this.checked);
        updateUserList();
    });

    // Intercept form submission to use AJAX
    const filterForm = document.querySelector('.card-body form');
    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault(); // Prevent default form submission
            updateUserList();
        });
    }

    // Update pagination links to use AJAX
    document.addEventListener('click', function(e) {
        if (e.target.matches('.pagination .page-link')) {
            e.preventDefault();
            const pageUrl = new URL(e.target.href);
            const currentUrl = new URL(window.location.href);
            const params = new URLSearchParams(currentUrl.search);
            
            // Get page from clicked link
            const page = pageUrl.searchParams.get('page');
            if (page) {
                params.set('page', page);
            } else {
                params.delete('page'); // If no page param, it's likely the first page
            }

            // Ensure show_admins is preserved
            params.set('show_admins', showAdminsSwitch.checked);

            const queryString = params.toString();
            const apiUrl = `/users/api/users?${queryString}`;

            makeRequest(apiUrl)
                .then(response => {
                    // Update user list
                    const userListContainer = document.querySelector('.row');
                    if (userListContainer) {
                        userListContainer.innerHTML = '';
                        if (response.users.length > 0) {
                            response.users.forEach(user => {
                                const userCard = `
                                    <div class="col-md-6 col-lg-4 mb-4">
                                        <div class="card h-100">
                                            <div class="card-body d-flex flex-column">
                                                <div class="d-flex align-items-center mb-3">
                                                    ${user.profile_picture ? 
                                                        `<img src="${user.profile_picture}" class="rounded-circle me-3" 
                                                            style="width: 60px; height: 60px; object-fit: cover;" alt="Photo de profil">` :
                                                        `<div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3"
                                                            style="width: 60px; height: 60px; font-size: 1.5rem;">
                                                            ${user.prenom.charAt(0)}${user.nom.charAt(0)}
                                                        </div>`
                                                    }
                                                    <div>
                                                        <h5 class="card-title mb-0">
                                                            <a href="/users/${user.id}" class="text-decoration-none text-dark">
                                                                ${user.prenom} ${user.nom}
                                                            </a>
                                                        </h5>
                                                        <p class="card-subtitle text-muted">${user.section_nom} - ${user.annee_diplome}</p>
                                                    </div>
                                                </div>
                                                ${user.current_position && user.current_employer ? 
                                                    `<p class="card-text mt-auto"><small class="text-muted">${user.current_position} chez ${user.current_employer}</small></p>` : ''
                                                }
                                            </div>
                                        </div>
                                    </div>
                                `;
                                userListContainer.insertAdjacentHTML('beforeend', userCard);
                            });
                        } else {
                            userListContainer.innerHTML = `
                                <div class="alert alert-info" role="alert">
                                    Aucun ancien trouvé correspondant à vos critères.
                                </div>
                            `;
                        }
                    }

                    // Update pagination links
                    const paginationNav = document.querySelector('.pagination');
                    if (paginationNav) {
                        paginationNav.innerHTML = ''; // Clear current pagination
                        const pagination = response.pagination;
                        const newBaseUrl = `/users?${params.toString()}`; // Base URL for pagination links

                        const prevLink = `
                            <li class="page-item ${!pagination.hasPrev ? 'disabled' : ''}">
                                <a class="page-link" href="${newBaseUrl}&page=${pagination.current - 1}" aria-label="Previous">
                                    <span aria-hidden="true">&laquo;</span>
                                </a>
                            </li>
                        `;
                        paginationNav.insertAdjacentHTML('beforeend', prevLink);

                        for (let i = 1; i <= pagination.total; i++) {
                            const pageLink = `
                                <li class="page-item ${pagination.current == i ? 'active' : ''}">
                                    <a class="page-link" href="${newBaseUrl}&page=${i}">${i}</a>
                                </li>
                            `;
                            paginationNav.insertAdjacentHTML('beforeend', pageLink);
                        }

                        const nextLink = `
                            <li class="page-item ${!pagination.hasNext ? 'disabled' : ''}">
                                <a class="page-link" href="${newBaseUrl}&page=${pagination.current + 1}" aria-label="Next">
                                    <span aria-hidden="true">&raquo;</span>
                                </a>
                            </li>
                        `;
                        paginationNav.insertAdjacentHTML('beforeend', nextLink);
                    }

                    // Update URL in browser without reloading
                    window.history.pushState({ path: pageUrl.pathname + '?' + pageUrl.searchParams.toString() }, '', pageUrl.pathname + '?' + pageUrl.searchParams.toString());
                })
                .catch(error => {
                    console.error('Error updating user list via pagination:', error);
                });
        }
    });
}