require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Customer = require('./models/Customer');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shiptrack';

// Local File Database Helper (Fallback)
const dbFile = path.join(__dirname, 'database.json');

const loadLocalDB = () => {
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify([]));
  }
  try {
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch (e) {
    return [];
  }
};

const saveLocalDB = (data) => {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
};

// Database State Flag
let useLocalDBFallback = false;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Basic Request Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Disable Mongoose query buffering globally so it fails fast if connection is down
mongoose.set('bufferCommands', false);

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 3000 // Timeout fast (3 seconds) to trigger local file fallback
  })
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    useLocalDBFallback = false;
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.log('--- FALLING BACK TO LOCAL FILE STORAGE (database.json) ---');
    useLocalDBFallback = true;
  });

// Input Validation Middleware
const validateCustomer = (req, res, next) => {
  const { name, phone, city, transportCompany } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push('Customer Name is required.');
  }
  if (!phone || typeof phone !== 'string' || phone.trim() === '') {
    errors.push('Phone Number is required.');
  }
  if (!city || typeof city !== 'string' || city.trim() === '') {
    errors.push('City is required.');
  }
  if (!transportCompany || typeof transportCompany !== 'string' || transportCompany.trim() === '') {
    errors.push('Transport Company is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  next();
};

// --- REST API ENDPOINTS ---

// GET /customers - Get all customer records
const getCustomers = async (req, res) => {
  try {
    if (useLocalDBFallback || mongoose.connection.readyState !== 1) {
      const list = loadLocalDB();
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(list);
    }
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve customers. ' + error.message });
  }
};

// GET /customers/export - Export all records to CSV format
const exportCustomers = async (req, res) => {
  try {
    let list = [];
    if (useLocalDBFallback || mongoose.connection.readyState !== 1) {
      list = loadLocalDB();
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      list = await Customer.find().sort({ createdAt: -1 });
    }

    const headers = [
      'ID',
      'Customer Name',
      'Phone',
      'Address',
      'City',
      'Transport Company',
      'Transport Company Contact',
      'GST Number',
      'Location',
      'Created At'
    ];

    // CSV cell-escaping function adhering to RFC 4180
    const escapeCSV = (val) => {
      if (val === undefined || val === null) return '';
      let str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = list.map((c) => [
      c.id,
      c.name,
      c.phone,
      c.address || '',
      c.city,
      c.transportCompany,
      c.transportCompanyContact || '',
      c.gstNumber || '',
      c.location || '',
      typeof c.createdAt === 'string' ? c.createdAt : c.createdAt.toISOString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map(escapeCSV).join(','))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=shiptrack_customers.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export CSV. ' + error.message });
  }
};

// POST /customers - Create a new customer
const createCustomer = async (req, res) => {
  try {
    const { name, phone, address, city, transportCompany, transportCompanyContact, gstNumber, location } = req.body;

    const record = {
      name: name.trim(),
      phone: phone.trim(),
      address: address ? address.trim() : '',
      city: city.trim(),
      transportCompany: transportCompany.trim(),
      transportCompanyContact: transportCompanyContact ? transportCompanyContact.trim() : '',
      gstNumber: gstNumber ? gstNumber.trim() : '',
      location: location ? location.trim() : ''
    };

    if (useLocalDBFallback || mongoose.connection.readyState !== 1) {
      const list = loadLocalDB();
      const newCustomer = {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        ...record,
        createdAt: new Date().toISOString()
      };
      list.push(newCustomer);
      saveLocalDB(list);
      return res.status(201).json(newCustomer);
    }

    const newCustomer = new Customer(record);
    const savedCustomer = await newCustomer.save();
    res.status(201).json(savedCustomer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create customer. ' + error.message });
  }
};

// PUT /customers/:id - Update an existing customer by ID
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, city, transportCompany, transportCompanyContact, gstNumber, location } = req.body;

    const record = {
      name: name.trim(),
      phone: phone.trim(),
      address: address ? address.trim() : '',
      city: city.trim(),
      transportCompany: transportCompany.trim(),
      transportCompanyContact: transportCompanyContact ? transportCompanyContact.trim() : '',
      gstNumber: gstNumber ? gstNumber.trim() : '',
      location: location ? location.trim() : ''
    };

    if (useLocalDBFallback || mongoose.connection.readyState !== 1) {
      const list = loadLocalDB();
      const index = list.findIndex((c) => c.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Customer not found.' });
      }

      const updatedCustomer = {
        ...list[index],
        ...record
      };
      list[index] = updatedCustomer;
      saveLocalDB(list);
      return res.json(updatedCustomer);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid Customer ID.' });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      record,
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer. ' + error.message });
  }
};

// DELETE /customers/:id - Delete a customer by ID
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (useLocalDBFallback || mongoose.connection.readyState !== 1) {
      const list = loadLocalDB();
      const filtered = list.filter((c) => c.id !== id);
      if (list.length === filtered.length) {
        return res.status(404).json({ error: 'Customer not found.' });
      }
      saveLocalDB(filtered);
      return res.json({ message: 'Customer deleted successfully.', id });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid Customer ID.' });
    }

    const deletedCustomer = await Customer.findByIdAndDelete(id);

    if (!deletedCustomer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    res.json({ message: 'Customer deleted successfully.', id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete customer. ' + error.message });
  }
};

// Map routes with and without /api prefix
app.get('/customers/export', exportCustomers);
app.get('/api/customers/export', exportCustomers);

app.get('/customers', getCustomers);
app.get('/api/customers', getCustomers);

app.post('/customers', validateCustomer, createCustomer);
app.post('/api/customers', validateCustomer, createCustomer);

app.put('/customers/:id', validateCustomer, updateCustomer);
app.put('/api/customers/:id', validateCustomer, updateCustomer);

app.delete('/customers/:id', deleteCustomer);
app.delete('/api/customers/:id', deleteCustomer);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error. ' + err.message });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[ShipTrack Server] Running at http://localhost:${PORT}`);
});

