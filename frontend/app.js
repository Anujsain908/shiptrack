// ShipTrack Client Application Controller

// Configure Backend API Base URL
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
  ? 'http://localhost:5000'
  : 'https://shiptrack-riqf.onrender.com';

// Application State
let customers = [];
let currentEditId = null;
let searchQuery = '';
let selectedCompany = 'ALL';

// DOM Elements
const tableBody = document.getElementById('table-body');
const emptyState = document.getElementById('empty-state');
const customersTable = document.getElementById('customers-table');

const statTotalCustomers = document.getElementById('stat-total-customers');
const statUniqueCompanies = document.getElementById('stat-unique-companies');
const statCitiesCovered = document.getElementById('stat-cities-covered');

const searchBar = document.getElementById('search-bar');
const filterCompany = document.getElementById('filter-company');

const btnAddCustomer = document.getElementById('btn-add-customer');
const btnExport = document.getElementById('btn-export');

const modal = document.getElementById('customer-modal');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.getElementById('modal-close');
const btnCancel = document.getElementById('btn-cancel');
const customerForm = document.getElementById('customer-form');

const citiesDatalist = document.getElementById('cities-datalist');
const companiesDatalist = document.getElementById('companies-datalist');
const toastContainer = document.getElementById('toast-container');

// Initial Setup & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Fetch initial data
  loadData();

  // Search & Filter Events
  searchBar.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderTable();
  });

  filterCompany.addEventListener('change', (e) => {
    selectedCompany = e.target.value;
    renderTable();
  });

  // Modal Open/Close Events
  btnAddCustomer.addEventListener('click', () => openModal());
  modalClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  // Close modal when clicking backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Form Submission
  customerForm.addEventListener('submit', handleFormSubmit);

  // CSV Export Trigger
  btnExport.addEventListener('click', () => {
    showToast('Exporting customer data to CSV...', 'info');
    // Direct browser redirect trigger to handle file attachment
    window.location.href = `${API_BASE}/api/customers/export`;
  });
});

// --- API Fetch Functions ---

async function loadData() {
  try {
    const response = await fetch(`${API_BASE}/api/customers`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    customers = await response.json();

    // Update filtering selectors
    populateDatalists();
    populateCompanyFilter();

    // Render
    renderTable();
  } catch (error) {
    console.error('Error fetching customers:', error);
    showToast('Failed to connect to the backend server.', 'error');
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="loading-state" style="color: var(--danger-text)">
          Error loading tracking logs. Please check if backend server is running.
        </td>
      </tr>
    `;
  }
}

// --- Render Functions ---

function renderTable() {
  // Filter records
  const filtered = customers.filter(customer => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery) ||
      customer.city.toLowerCase().includes(searchQuery) ||
      customer.phone.toLowerCase().includes(searchQuery) ||
      customer.transportCompany.toLowerCase().includes(searchQuery);

    const matchesCompany = (selectedCompany === 'ALL' || customer.transportCompany === selectedCompany);

    return matchesSearch && matchesCompany;
  });

  // Update Statistics (Based on full dataset to reflect overall database state)
  updateStats();

  // Clear table body
  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    customersTable.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  customersTable.classList.remove('hidden');
  emptyState.classList.add('hidden');

  // Insert rows
  filtered.forEach((customer, index) => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${index + 1}</td>
      <td style="font-weight: 600;">${escapeHTML(customer.name)}</td>
      <td>${escapeHTML(customer.phone)}</td>
      <td class="text-secondary">${escapeHTML(customer.address || '-')}</td>
      <td>${escapeHTML(customer.city)}</td>
      <td style="font-weight: 500;">${escapeHTML(customer.transportCompany)}</td>
      <td>${escapeHTML(customer.transportCompanyContact || '-')}</td>
      <td><code>${escapeHTML(customer.gstNumber || '-')}</code></td>
      <td>${escapeHTML(customer.location || '-')}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-action edit" onclick="editCustomer('${customer.id}')" title="Edit Customer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="btn-action delete" onclick="deleteCustomer('${customer.id}', '${escapeQuote(customer.name)}')" title="Delete Customer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function updateStats() {
  statTotalCustomers.textContent = customers.length;

  const companies = customers.map(c => c.transportCompany.trim());
  const uniqueCompanies = [...new Set(companies)].filter(Boolean);
  statUniqueCompanies.textContent = uniqueCompanies.length;

  const cities = customers.map(c => c.city.trim());
  const uniqueCities = [...new Set(cities)].filter(Boolean);
  statCitiesCovered.textContent = uniqueCities.length;
}

// Populates Autocomplete lists for the modal inputs
function populateDatalists() {
  const cities = [...new Set(customers.map(c => c.city.trim()))].filter(Boolean).sort();
  citiesDatalist.innerHTML = '';
  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city;
    citiesDatalist.appendChild(opt);
  });

  const companies = [...new Set(customers.map(c => c.transportCompany.trim()))].filter(Boolean).sort();
  companiesDatalist.innerHTML = '';
  companies.forEach(company => {
    const opt = document.createElement('option');
    opt.value = company;
    companiesDatalist.appendChild(opt);
  });
}

// Populates dropdown transport filter
function populateCompanyFilter() {
  const companies = [...new Set(customers.map(c => c.transportCompany.trim()))].filter(Boolean).sort();

  // Save current selection
  const currentSelection = filterCompany.value;

  // Reset and add ALL option
  filterCompany.innerHTML = '<option value="ALL">All Transport Companies</option>';

  companies.forEach(company => {
    const opt = document.createElement('option');
    opt.value = company;
    opt.textContent = company;
    filterCompany.appendChild(opt);
  });

  // Restore selection if it still exists
  if (companies.includes(currentSelection)) {
    filterCompany.value = currentSelection;
  } else {
    filterCompany.value = 'ALL';
    selectedCompany = 'ALL';
  }
}

// --- Modal Operations ---

function openModal(customerId = null) {
  clearValidationErrors();

  if (customerId) {
    currentEditId = customerId;
    modalTitle.textContent = 'Edit Customer Details';
    const customer = customers.find(c => c.id === customerId);

    if (customer) {
      document.getElementById('customer-id').value = customer.id;
      document.getElementById('customer-name').value = customer.name;
      document.getElementById('customer-phone').value = customer.phone;
      document.getElementById('customer-city').value = customer.city;
      document.getElementById('customer-company').value = customer.transportCompany;
      document.getElementById('customer-company-contact').value = customer.transportCompanyContact || '';
      document.getElementById('customer-gst').value = customer.gstNumber || '';
      document.getElementById('customer-location').value = customer.location || '';
      document.getElementById('customer-address').value = customer.address || '';
    }
  } else {
    currentEditId = null;
    modalTitle.textContent = 'Add New Customer';
    customerForm.reset();
    document.getElementById('customer-id').value = '';
  }

  modal.classList.remove('hidden');
  document.getElementById('customer-name').focus();
}

function closeModal() {
  modal.classList.add('hidden');
  customerForm.reset();
  currentEditId = null;
}

// --- Form Validation and Submission ---

function clearValidationErrors() {
  const groups = document.querySelectorAll('.form-group');
  groups.forEach(g => g.classList.remove('invalid'));

  const errors = document.querySelectorAll('.error-msg');
  errors.forEach(e => e.textContent = '');
}

function validateForm() {
  clearValidationErrors();
  let isValid = true;

  const name = document.getElementById('customer-name');
  const phone = document.getElementById('customer-phone');
  const city = document.getElementById('customer-city');
  const company = document.getElementById('customer-company');

  if (!name.value.trim()) {
    name.parentElement.classList.add('invalid');
    document.getElementById('err-name').textContent = 'Name is required';
    isValid = false;
  }

  if (!phone.value.trim()) {
    phone.parentElement.classList.add('invalid');
    document.getElementById('err-phone').textContent = 'Phone number is required';
    isValid = false;
  }

  if (!city.value.trim()) {
    city.parentElement.classList.add('invalid');
    document.getElementById('err-city').textContent = 'City is required';
    isValid = false;
  }

  if (!company.value.trim()) {
    company.parentElement.classList.add('invalid');
    document.getElementById('err-company').textContent = 'Transport company is required';
    isValid = false;
  }

  return isValid;
}

async function handleFormSubmit(e) {
  e.preventDefault();

  if (!validateForm()) return;

  const payload = {
    name: document.getElementById('customer-name').value.trim(),
    phone: document.getElementById('customer-phone').value.trim(),
    city: document.getElementById('customer-city').value.trim(),
    transportCompany: document.getElementById('customer-company').value.trim(),
    transportCompanyContact: document.getElementById('customer-company-contact').value.trim(),
    gstNumber: document.getElementById('customer-gst').value.trim(),
    location: document.getElementById('customer-location').value.trim(),
    address: document.getElementById('customer-address').value.trim()
  };

  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    let url = `${API_BASE}/api/customers`;
    let method = 'POST';

    if (currentEditId) {
      url = `${API_BASE}/api/customers/${currentEditId}`;
      method = 'PUT';
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Server error saving record.');
    }

    showToast(
      currentEditId
        ? `Successfully updated details for ${payload.name}.`
        : `Successfully added ${payload.name} to tracking records.`,
      'success'
    );

    closeModal();
    loadData();
  } catch (error) {
    console.error('Error submitting customer:', error);
    showToast(error.message || 'Failed to save customer entry.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Entry';
  }
}

// --- Edit/Delete Triggers (Globals for HTML bindings) ---

window.editCustomer = function(id) {
  openModal(id);
};

window.deleteCustomer = async function(id, name) {
  const confirmed = confirm(`Are you sure you want to permanently delete customer logs for "${name}"?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE}/api/customers/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete record.');
    }

    showToast(`Successfully removed customer records for ${name}.`, 'success');
    loadData();
  } catch (error) {
    console.error('Error deleting customer:', error);
    showToast(error.message || 'Failed to delete customer record.', 'error');
  }
};

// --- Toast System ---

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Icon depending on toast type
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg style="color: var(--success); width: 1.25rem; height: 1.25rem;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg style="color: var(--danger); width: 1.25rem; height: 1.25rem;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else if (type === 'info') {
    iconSvg = `<svg style="color: var(--primary); width: 1.25rem; height: 1.25rem;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.625rem;">
      ${iconSvg}
      <span class="toast-content">${escapeHTML(message)}</span>
    </div>
    <button class="toast-close" aria-label="Close notification">
      <svg class="toast-close-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  // Close event listener
  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  // Append toast
  toastContainer.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    removeToast(toast);
  }, 4000);
}

function removeToast(toast) {
  if (!toast.parentNode) return;
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(50px) scale(0.9)';
  setTimeout(() => {
    if (toast.parentNode) {
      toastContainer.removeChild(toast);
    }
  }, 250);
}

// --- Escaping Helpers ---

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeQuote(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

