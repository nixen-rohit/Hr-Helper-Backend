const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data.json');

// Read data from JSON file
const readData = () => {
  try {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Error reading data.json:', error.message);
    console.error('Please ensure data.json exists in the backend directory');
    process.exit(1);
  }
};

// Write data to JSON file
const writeData = (data) => {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

// Filter and sort logic
const applyFilters = (data, filters, logic) => {
  if (!filters || filters.length === 0) return data;
  
  return data.filter(record => {
    const results = filters.map(filter => {
      const value = record[filter.field];
      const filterValue = filter.value;
      
      if (value === undefined || value === null) return false;
      
      switch (filter.operator) {
        case 'equals':
          return String(value).toLowerCase() === String(filterValue).toLowerCase();
        case 'contains':
          return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
        case '>':
          return Number(value) > Number(filterValue);
        case '<':
          return Number(value) < Number(filterValue);
        case '>=':
          return Number(value) >= Number(filterValue);
        case '<=':
          return Number(value) <= Number(filterValue);
        case 'startsWith':
          return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
        case 'endsWith':
          return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
        default:
          return false;
      }
    });
    
    return logic === 'OR' ? results.some(r => r) : results.every(r => r);
  });
};

const applySort = (data, sortField, sortOrder) => {
  if (!sortField) return data;
  
  return [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    let comparison = 0;
    if (typeof aVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else {
      comparison = aVal - bVal;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
};

const paginate = (data, page, limit) => {
  const start = page * limit;
  const end = start + limit;
  return {
    data: data.slice(start, end),
    total: data.length,
    hasMore: end < data.length
  };
};

// CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

// Request handler
const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // GET /api/records
  if (pathname === '/api/records' && req.method === 'GET') {
    const query = parsedUrl.query;
    const page = parseInt(query.page) || 0;
    const limit = parseInt(query.limit) || 50;
    const sortField = query.sortField;
    const sortOrder = query.sortOrder || 'asc';
    const filters = query.filters ? JSON.parse(query.filters) : [];
    const logic = query.logic || 'AND';
    
    const { employees } = readData();
    let result = employees;
    result = applyFilters(result, filters, logic);
    result = applySort(result, sortField, sortOrder);
    const paginatedResult = paginate(result, page, limit);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(paginatedResult));
    return;
  }
  
  // GET /api/presets
  if (pathname === '/api/presets' && req.method === 'GET') {
    const { presets } = readData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(presets));
    return;
  }
  
  // POST /api/presets
  if (pathname === '/api/presets' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const newPreset = JSON.parse(body);
      const data = readData();
      newPreset.id = data.presets.length > 0 ? Math.max(...data.presets.map(p => p.id)) + 1 : 1;
      data.presets.push(newPreset);
      writeData(data);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newPreset));
    });
    return;
  }
  
  // PUT /api/presets/:id/default
  if (pathname.startsWith('/api/presets/') && pathname.endsWith('/default') && req.method === 'PUT') {
    const id = parseInt(pathname.split('/')[3]);
    const data = readData();
    data.presets = data.presets.map(p => ({ ...p, isDefault: p.id === id }));
    writeData(data);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  // DELETE /api/presets/:id
  if (pathname.startsWith('/api/presets/') && req.method === 'DELETE') {
    const id = parseInt(pathname.split('/')[3]);
    const data = readData();
    data.presets = data.presets.filter(p => p.id !== id);
    writeData(data);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3001;
server.listen(PORT, () => {
  const { employees } = readData();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Loaded ${employees.length} employees from data.json`);
});